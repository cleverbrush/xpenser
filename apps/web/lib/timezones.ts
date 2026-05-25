export function supportedTimeZones(): string[] {
    const supported =
        typeof Intl.supportedValuesOf === 'function'
            ? Intl.supportedValuesOf('timeZone')
            : [];
    return ['UTC', ...supported.filter(timeZone => timeZone !== 'UTC')];
}

export function timeZoneLabel(timeZone: string): string {
    return timeZone.replaceAll('_', ' ');
}
