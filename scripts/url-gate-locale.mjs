/**
 * A docs locale is not necessarily an application locale (Arabic), and the
 * application can serve a language absent from docs (Polish). Resolve against
 * the owner of the address: registered content keeps its language and direction;
 * application pages use the application's own locale parser.
 */
export const expectedHtmlLocale = (pathname, {
    contentPaths,
    contentLocales,
    contentRootLocale,
    splitAppLocalePath,
}) => {
    if (!contentPaths.has(pathname)) {
        return { language: splitAppLocalePath(pathname).language }
    }
    return contentLocales.find((locale) =>
        locale.prefix && (pathname === locale.prefix || pathname.startsWith(`${locale.prefix}/`))
    ) ?? contentRootLocale
}

/** Probe the artifact the app actually emits, including every locale's home. */
export const appHtmlArtifactPath = (canonical, { splitAppLocalePath, routeFile }) => {
    const { language, path } = splitAppLocalePath(canonical)
    const slug = path.replace(/^\//, '').replace(/\/$/, '')
    return `/${routeFile({ slug }, language)}`
}
