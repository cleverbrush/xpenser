import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import {
    chmodSync, copyFileSync, existsSync, mkdirSync, mkdtempSync,
    readFileSync, rmSync, symlinkSync, writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { afterEach, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';

const scripts = dirname(fileURLToPath(import.meta.url));
const directories = [];

function temporaryDirectory() {
    const directory = mkdtempSync(join(tmpdir(), 'production-deploy-'));
    directories.push(directory);
    return directory;
}

afterEach(() => {
    for (const directory of directories.splice(0)) {
        rmSync(directory, { recursive: true, force: true });
    }
});

function git(directory, ...args) {
    const result = spawnSync('git', ['-C', directory, ...args], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    return result.stdout.trim();
}

const fakeTool = `#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const tool = path.basename(process.argv[1]);
const args = process.argv.slice(2);
const record = (kind = 'command') => fs.appendFileSync(process.env.MOCK_LOG,
    JSON.stringify({ tool, args, kind }) + '\\n');
record();
if (tool === 'curl') process.exit(process.env.MOCK_FAIL === 'smoke' ? 22 : 0);
if (tool === 'ssh') process.exit(0);
if (args[0] === 'ps') {
    console.log('production-postgres');
} else if (args[0] === 'inspect') {
    const format = args[args.indexOf('--format') + 1];
    if (format.includes('Health.Status')) {
        console.log(process.env.MOCK_FAIL === 'postgres' ? 'unhealthy' : 'healthy');
    } else {
        const service = args.at(-1).replace(/-container$/, '');
        const state = path.join(process.env.MOCK_DIRECTORY, service);
        const image = fs.existsSync(state) ? fs.readFileSync(state, 'utf8') : service + ':previous';
        console.log(JSON.stringify({ image, image_id: 'sha256:' + service,
            compose_files: '/legacy/docker-compose.prod.yml,/legacy/release.yml' }));
    }
} else if (args[0] === 'compose') {
    const command = args.find(value => ['config', 'build', 'up', 'ps', 'logs'].includes(value));
    if (command === 'build') {
        record('build-start');
        if (process.env.MOCK_BUILD_DELAY) {
            Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0,
                Number(process.env.MOCK_BUILD_DELAY));
        }
        if (process.env.MOCK_FAIL === 'build') process.exit(42);
        record('build-end');
    } else if (command === 'up') {
        if (process.env.MOCK_FAIL === 'api' && args.at(-1) === 'api') process.exit(43);
        if (process.env.MOCK_FAIL === 'web' && args.includes('web')) process.exit(44);
        const files = args.flatMap((value, index) => value === '--file' ? [args[index + 1]] : []);
        const images = JSON.parse(fs.readFileSync(files.at(-1), 'utf8')).services;
        for (const service of ['api', 'web', 'telegram-bot']) {
            if (args.includes(service)) fs.writeFileSync(path.join(process.env.MOCK_DIRECTORY, service), images[service].image);
        }
    } else if (command === 'ps' && args.includes('--quiet')) {
        console.log(args.at(-1) + '-container');
    } else if (command === 'ps' && args.includes('--services')) {
        if (process.env.MOCK_FAIL !== 'telegram') console.log('telegram-bot');
    } else if (command === 'logs') {
        console.log('retained diagnostic output');
    }
} else {
    console.error('Unexpected Docker operation', args);
    process.exit(99);
}
`;

function fixture() {
    const root = temporaryDirectory();
    const source = join(root, 'source');
    const bin = join(root, 'bin');
    const state = join(root, 'state');
    mkdirSync(source);
    mkdirSync(bin);
    mkdirSync(state);
    git(source, 'init', '--initial-branch=main');
    git(source, 'config', 'user.name', 'Deployment tests');
    git(source, 'config', 'user.email', 'deploy-tests@example.invalid');
    writeFileSync(join(source, 'package.json'), '{"version":"1.2.3"}\n');
    writeFileSync(join(source, 'docker-compose.prod.yml'), 'services: {}\n');
    git(source, 'add', '.');
    git(source, 'commit', '-m', 'First release');
    const first = git(source, 'rev-parse', 'HEAD');
    writeFileSync(join(source, 'release.txt'), 'second release');
    git(source, 'add', '.');
    git(source, 'commit', '-m', 'Second release');
    const second = git(source, 'rev-parse', 'HEAD');
    git(source, 'switch', '--orphan', 'unrelated');
    writeFileSync(join(source, 'other.txt'), 'unrelated');
    git(source, 'add', '.');
    git(source, 'commit', '-m', 'Unrelated release');
    const unrelated = git(source, 'rev-parse', 'HEAD');
    git(source, 'switch', 'main');
    const envFile = join(root, 'production.env');
    writeFileSync(envFile, 'JWT_SECRET=production-secret-must-stay-on-host\n');
    const config = join(root, 'prod-deploy.env');
    const lock = join(root, 'build.lock');
    writeFileSync(config, [
        'PROD_DEPLOY_PROJECT=sandbox',
        'PROD_DEPLOY_BRANCH=main',
        `PROD_DEPLOY_REPOSITORY_URL=${source}`,
        `PROD_DEPLOY_ENV_FILE=${envFile}`,
        'PROD_DEPLOY_URL=https://production.example.invalid',
        `PROD_DEPLOY_STATE_DIR=${state}`,
        `PROD_DEPLOY_BUILD_LOCK=${lock}`
    ].join('\n'));
    writeFileSync(join(state, 'current.json'), JSON.stringify({ sha: first, baseline: true }));
    const fake = join(root, 'fake-tool.cjs');
    writeFileSync(fake, fakeTool);
    chmodSync(fake, 0o755);
    for (const tool of ['docker', 'curl', 'ssh']) symlinkSync(fake, join(bin, tool));
    const log = join(root, 'commands.jsonl');
    const env = {
        ...process.env,
        PATH: `${bin}:${process.env.PATH}`,
        PROD_DEPLOY_CONFIG: config,
        MOCK_LOG: log,
        MOCK_DIRECTORY: root
    };
    const commands = () => existsSync(log)
        ? readFileSync(log, 'utf8').trim().split('\n').filter(Boolean).map(line => JSON.parse(line))
        : [];
    const run = (sha = second, extraEnv = {}) => spawnSync('bash', [join(scripts, 'prod-deploy.sh'), sha], {
        env: { ...env, ...extraEnv }, encoding: 'utf8', timeout: 20000
    });
    return { root, source, envFile, state, config, lock, env, log, first, second, unrelated, commands, run };
}

test('builds the exact revision before replacing applications and preserves production data/configuration', () => {
    const f = fixture();
    const originalEnv = readFileSync(f.envFile, 'utf8');
    const result = f.run();
    assert.equal(result.status, 0, result.stderr);
    const current = JSON.parse(readFileSync(join(f.state, 'current.json')));
    assert.equal(current.sha, f.second);
    assert.equal(JSON.parse(readFileSync(join(f.state, 'previous.json'))).sha, f.first);
    assert.equal(readFileSync(f.envFile, 'utf8'), originalEnv);
    assert.equal(existsSync(join(current.project_directory, '.env')), false);
    assert.equal(readFileSync(join(current.project_directory, 'release.txt'), 'utf8'), 'second release');
    const images = JSON.parse(readFileSync(current.compose_files[1])).services;
    for (const service of ['api', 'web', 'telegram-bot']) {
        assert.equal(images[service].image, `sandbox-${service}:${f.second}`);
        assert.equal(images[service].environment.npm_package_version, '1.2.3');
        assert.equal(images[service].build.labels['org.opencontainers.image.revision'], f.second);
    }
    const commands = f.commands();
    const up = commands.filter(c => c.args.includes('up'));
    assert.equal(up.length, 2);
    assert.equal(up[0].args.at(-1), 'api');
    assert.deepEqual(up[1].args.slice(-2), ['web', 'telegram-bot']);
    assert.ok(commands.findIndex(c => c.kind === 'build-end') < commands.findIndex(c => c.args.includes('up')));
    for (const c of up) {
        assert.ok(c.args.includes('--no-build') && c.args.includes('--no-deps') && c.args.includes('--wait'));
        assert.ok(!c.args.includes('postgres'));
        assert.equal(c.args[c.args.indexOf('--project-name') + 1], 'sandbox');
        assert.equal(c.args[c.args.indexOf('--env-file') + 1], f.envFile);
    }
    assert.ok(!commands.some(c => c.args.includes('down') || c.args.includes('prune') || c.args.includes('rm')));
    assert.deepEqual(commands.filter(c => c.tool === 'curl').map(c => c.args.at(-1)), [
        'https://production.example.invalid/', 'https://production.example.invalid/api/health'
    ]);
    assert.ok(!`${result.stdout}${result.stderr}`.includes('production-secret-must-stay-on-host'));
});

test('failed builds never replace containers or advance release state', () => {
    const f = fixture();
    const result = f.run(f.second, { MOCK_FAIL: 'build' });
    assert.notEqual(result.status, 0);
    assert.ok(!f.commands().some(c => c.args.includes('up')));
    assert.equal(JSON.parse(readFileSync(join(f.state, 'current.json'))).sha, f.first);
    assert.equal(existsSync(join(f.state, 'last-attempt.json')), false);
});

for (const failure of ['api', 'web', 'smoke', 'telegram']) {
    test(`${failure} failure is reported, retains diagnostics, and blocks older retries`, () => {
        const f = fixture();
        const result = f.run(f.second, { MOCK_FAIL: failure });
        assert.notEqual(result.status, 0);
        assert.equal(JSON.parse(readFileSync(join(f.state, 'current.json'))).sha, f.first);
        const attempt = JSON.parse(readFileSync(join(f.state, 'last-attempt.json')));
        assert.equal(attempt.sha, f.second);
        assert.ok(existsSync(join(attempt.release_dir, 'failed')));
        assert.ok(readFileSync(join(attempt.release_dir, 'services.log'), 'utf8').includes('retained diagnostic output'));
        assert.ok(existsSync(join(attempt.release_dir, 'previous-containers.json')));
        if (failure === 'api') assert.equal(f.commands().filter(c => c.args.includes('up')).length, 1);
        writeFileSync(f.log, '');
        assert.notEqual(f.run(f.first).status, 0);
        assert.ok(!f.commands().some(c => c.args.includes('build') || c.args.includes('up')));
        assert.equal(f.run().status, 0, 'retrying the same revision should recover');
    });
}

test('rejects unknown/unrelated commits, unsafe inputs, and unhealthy PostgreSQL before builds', () => {
    const f = fixture();
    for (const sha of [f.unrelated, 'f'.repeat(40), `${f.second}; touch /tmp/unsafe`, '', '../main']) {
        assert.notEqual(f.run(sha).status, 0);
    }
    assert.notEqual(f.run(f.second, { MOCK_FAIL: 'postgres' }).status, 0);
    assert.ok(!f.commands().some(c => c.args.includes('build') || c.args.includes('up')));
});

test('cannot roll back a newer successful release', () => {
    const f = fixture();
    assert.equal(f.run().status, 0);
    writeFileSync(f.log, '');
    assert.notEqual(f.run(f.first).status, 0);
    assert.ok(!f.commands().some(c => c.args.includes('build') || c.args.includes('up')));
    assert.equal(JSON.parse(readFileSync(join(f.state, 'current.json'))).sha, f.second);
});

async function until(predicate) {
    for (let i = 0; i < 400; i++) {
        if (predicate()) return;
        await delay(10);
    }
    assert.fail('Timed out waiting for fixture process');
}

function start(f, sha, extraEnv = {}) {
    const child = spawn('bash', [join(scripts, 'prod-deploy.sh'), sha], {
        env: { ...f.env, ...extraEnv }, stdio: ['ignore', 'pipe', 'pipe']
    });
    let stderr = '';
    child.stdout.resume();
    child.stderr.on('data', chunk => { stderr += chunk; });
    const completed = once(child, 'exit').then(([code]) => {
        assert.equal(code, 0, stderr);
    });
    return { child, completed };
}

test('concurrent deployments cannot interleave builds or replace a newer release', async () => {
    const f = fixture();
    const first = start(f, f.first, { MOCK_BUILD_DELAY: '250' });
    await until(() => f.commands().some(c => c.kind === 'build-start'));
    const second = start(f, f.second);
    await Promise.all([first.completed, second.completed]);
    assert.deepEqual(f.commands().filter(c => c.kind.startsWith('build-')).map(c => c.kind), [
        'build-start', 'build-end', 'build-start', 'build-end'
    ]);
    assert.equal(JSON.parse(readFileSync(join(f.state, 'current.json'))).sha, f.second);
});

test('waits for the build lock shared with preview deployments', async () => {
    const f = fixture();
    const ready = join(f.root, 'lock-ready');
    const release = join(f.root, 'unlock');
    const holder = spawn('flock', ['--exclusive', f.lock, process.execPath, '-e',
        'const fs=require("node:fs");fs.writeFileSync(process.argv[1],"");const timer=setInterval(()=>{if(fs.existsSync(process.argv[2])){clearInterval(timer)}},10)', ready, release],
        { stdio: 'ignore' });
    const holderDone = once(holder, 'exit');
    await until(() => existsSync(ready));
    const runner = start(f, f.second);
    try {
        await until(() => f.commands().some(c => c.args.includes('config')));
        await delay(100);
        assert.ok(!f.commands().some(c => c.kind === 'build-start'));
    } finally {
        writeFileSync(release, '');
        await holderDone;
        await runner.completed;
    }
});

test('restricted SSH accepts only a literal deployment command for the configured role', () => {
    const root = temporaryDirectory();
    const wrapper = join(root, 'restricted-ssh-command');
    copyFileSync(join(scripts, 'prod-deploy-restricted-ssh-command'), wrapper);
    for (const name of ['prod-deploy.sh', 'prod-deploy-proxy.sh']) {
        writeFileSync(join(root, name), '#!/usr/bin/env bash\nprintf "%s:%s\\n" "$(basename "$0")" "$*"\n');
        chmodSync(join(root, name), 0o755);
    }
    const sha = 'a'.repeat(40);
    const run = (command, role = 'runner') => spawnSync('bash', [wrapper, role], {
        env: { ...process.env, SSH_ORIGINAL_COMMAND: command }, encoding: 'utf8'
    });
    for (const role of ['runner', 'proxy']) {
        const result = run(`deploy ${sha}`, role);
        assert.equal(result.status, 0, result.stderr);
        assert.equal(result.stdout.trim(), `${role === 'runner' ? 'prod-deploy.sh' : 'prod-deploy-proxy.sh'}:${sha}`);
    }
    for (const command of ['', 'bash', `deploy ${sha}; id`, `deploy ${sha}\nid`,
        `deploy '${sha}'`, `ENV=1 deploy ${sha}`, `deploy ${sha} extra`, 'deploy main']) {
        assert.equal(run(command).status, 126, command);
    }
    assert.equal(run(`deploy ${sha}`, 'other').status, 126);
});

test('proxy pins the target host key and forwards only the validated SHA', () => {
    const f = fixture();
    writeFileSync(f.config, [
        'PROD_DEPLOY_TARGET_HOST=target.example.invalid',
        'PROD_DEPLOY_TARGET_USER=deploy',
        'PROD_DEPLOY_TARGET_KEY=/fixed/key',
        'PROD_DEPLOY_TARGET_KNOWN_HOSTS=/fixed/known_hosts',
        'PROD_DEPLOY_TARGET_PORT=2222'
    ].join('\n'));
    const run = sha => spawnSync('bash', [join(scripts, 'prod-deploy-proxy.sh'), sha], {
        env: f.env, encoding: 'utf8'
    });
    assert.equal(run(f.second).status, 0);
    const command = f.commands()[0];
    assert.equal(command.tool, 'ssh');
    assert.ok(command.args.includes('StrictHostKeyChecking=yes'));
    assert.ok(command.args.includes('UserKnownHostsFile=/fixed/known_hosts'));
    assert.deepEqual(command.args.slice(-2), ['deploy@target.example.invalid', `deploy ${f.second}`]);
    assert.equal(run(`${f.second}; id`).status, 2);
    assert.equal(f.commands().length, 1);
});
