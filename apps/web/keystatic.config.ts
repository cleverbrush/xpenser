import { collection, config, fields } from '@keystatic/core';

const hasGitHubStorageCredentials = Boolean(
    process.env.KEYSTATIC_GITHUB_CLIENT_ID &&
        process.env.KEYSTATIC_GITHUB_CLIENT_SECRET &&
        process.env.KEYSTATIC_SECRET
);

const useLocalStorage =
    process.env.NODE_ENV !== 'production' && !hasGitHubStorageCredentials;

export const isKeystaticAdminEnabled =
    useLocalStorage || hasGitHubStorageCredentials;

export default config({
    storage: useLocalStorage
        ? { kind: 'local' }
        : {
              kind: 'github',
              repo: {
                  owner: 'cleverbrush',
                  name: 'xpenser'
              }
          },
    collections: {
        blog: collection({
            label: 'Blog Posts',
            path: 'content/blog/*',
            slugField: 'slug',
            format: { contentField: 'content' },
            columns: ['title', 'publishedAt', 'draft'],
            schema: {
                title: fields.text({
                    label: 'Title',
                    validation: { isRequired: true }
                }),
                slug: fields.slug({
                    name: {
                        label: 'Slug Source',
                        validation: { isRequired: true }
                    },
                    slug: {
                        label: 'URL Slug',
                        validation: {
                            pattern: {
                                regex: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
                                message:
                                    'Use lowercase letters, numbers, and hyphens.'
                            }
                        }
                    }
                }),
                description: fields.text({
                    label: 'Description',
                    multiline: true,
                    validation: {
                        isRequired: true,
                        length: { min: 80, max: 180 }
                    }
                }),
                sourcePrNumber: fields.text({
                    label: 'Source PR Number',
                    validation: {
                        pattern: {
                            regex: /^$|^[0-9]+$/,
                            message: 'Use digits only, for example 59.'
                        }
                    }
                }),
                sourcePrUrl: fields.text({
                    label: 'Source PR URL'
                }),
                heroImage: fields.text({
                    label: 'Hero Image Path'
                }),
                heroImageAlt: fields.text({
                    label: 'Hero Image Alt Text'
                }),
                publishedAt: fields.date({
                    label: 'Published Date',
                    defaultValue: { kind: 'today' },
                    validation: { isRequired: true }
                }),
                updatedAt: fields.date({
                    label: 'Updated Date',
                    defaultValue: { kind: 'today' }
                }),
                targetKeyword: fields.text({
                    label: 'Target Keyword',
                    validation: { isRequired: true }
                }),
                keywords: fields.array(
                    fields.text({
                        label: 'Keyword',
                        validation: { isRequired: true }
                    }),
                    {
                        label: 'Secondary Keywords',
                        validation: { length: { max: 5 } },
                        itemLabel: props => props.value
                    }
                ),
                draft: fields.checkbox({
                    label: 'Draft',
                    defaultValue: false
                }),
                content: fields.mdx({
                    label: 'Content',
                    extension: 'mdx'
                })
            }
        })
    },
    ui: {
        brand: { name: 'xpenser CMS' },
        navigation: ['blog']
    }
});
