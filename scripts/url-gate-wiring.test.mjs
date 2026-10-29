import { describe, expect, it } from 'vitest'
import { BACKEND_STAND_IN, containerServer, standInBackendStatus } from './url-gate-wiring.mjs'

const wire = (text) => containerServer(text, {
    port: 18100,
    root: '/work/app/dist',
    cacheDir: '/work/tmp/seo-validation',
    redirectsPath: '/work/docs/redirects.conf',
})

describe('URL gates wire a container config to the harness', () => {
    it('points the re-resolving backend upstream at the stand-in and drops only `resolve`', () => {
        const shipped = [
            'resolver 127.0.0.11 valid=10s ipv6=off;',
            'upstream seo_backend {',
            '    zone seo_backend 64k;',
            '    server backend:8080 resolve max_fails=0;',
            '}',
            'location /x { proxy_pass http://seo_backend; }',
        ].join('\n')
        expect(wire(shipped)).toBe(shipped.replace('server backend:8080 resolve max_fails=0;', `server ${BACKEND_STAND_IN} max_fails=0;`))
    })

    it('points a direct proxy_pass at the stand-in', () => {
        expect(wire('proxy_pass http://backend:8080/api/contests;')).toBe(`proxy_pass http://${BACKEND_STAND_IN}/api/contests;`)
    })

    it('wires the port, root, cache and redirects include and leaves every other directive as shipped', () => {
        const shipped = [
            'proxy_cache_path /var/cache/nginx/seo-validation levels=1:2 keys_zone=seo_validation:1m;',
            'server {',
            '    listen 80;',
            '    server_name localhost;',
            '    root /usr/share/nginx/html;',
            '    include /etc/nginx/snippets/redirects.conf;',
            '    location / { try_files $uri $uri/ =404; }',
            '}',
        ].join('\n')
        expect(wire(shipped)).toBe([
            'proxy_cache_path /work/tmp/seo-validation levels=1:2 keys_zone=seo_validation:1m;',
            'server {',
            '    listen 18100;',
            '    server_name localhost;',
            '    root /work/app/dist;',
            '    include /work/docs/redirects.conf;',
            '    location / { try_files $uri $uri/ =404; }',
            '}',
        ].join('\n'))
    })

    it('leaves no Docker service name and no `resolve` parameter behind', () => {
        const wired = wire('upstream a {\n    server backend:8080 resolve;\n}\nproxy_pass http://backend:8080;\n')
        expect(wired).not.toMatch(/backend:8080/)
        expect(wired).not.toMatch(/\bresolve\b/)
    })
})

describe('the stand-in backend answers the validators for what the sitemaps publish', () => {
    const published = { tasks: new Set(['domer-narezki', 'tarea-ñ']), products: new Set(['inner-club']) }

    it('finds a published task and product and nothing else', () => {
        expect(standInBackendStatus('/api/contests/domer-narezki', published)).toBe(200)
        expect(standInBackendStatus('/api/contests/6a74ae08d7a6b8417afccb09', published)).toBe(404)
        expect(standInBackendStatus('/api/store/products/inner-club', published)).toBe(200)
        expect(standInBackendStatus('/api/store/products/gone', published)).toBe(404)
    })

    it('reads a percent-encoded key the way the backend does', () => {
        expect(standInBackendStatus('/api/contests/tarea-%C3%B1', published)).toBe(200)
        expect(standInBackendStatus('/api/contests/%E0%A4%A', published)).toBe(404)
    })

    it('knows no profile and no other endpoint', () => {
        expect(standInBackendStatus('/api/users/username/someone', published)).toBe(404)
        expect(standInBackendStatus('/api/geo/context', published)).toBe(404)
        expect(standInBackendStatus('/tasks/domer-narezki', published)).toBe(404)
    })
})
