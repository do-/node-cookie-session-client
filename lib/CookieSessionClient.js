const {CookieJar, CookieAccessInfo} = require ('cookiejar')
const FetchRequst = require ('./FetchRequst')

class CookieSessionClient {

    constructor (options = {}) {

        {
            const {auth} = options
            if (!auth) throw Error ('Empty `auth`')
            if (!auth.url) throw Error ('Empty `auth.url`')
            this.auth = {...auth}
            if (!this.auth.check) this.auth.check = _ => true
        }

        this.base               = options.base               ?? ''
        this.userAgent          = options.userAgent          ?? 'CookieSessionClient'
        this.defaultContentType = options.defaultContentType ?? 'application/json'
        this.timeout            = options.timeout
        this.headers            = {
            "accept": "*/*",
            "origin": this.base,
            "user-agent": this.userAgent,
            ...(options.headers ?? {})
        }

        this.encoders = {
            'application/json': body => JSON.stringify (body),
            'application/x-www-form-urlencoded': body => new URLSearchParams (body).toString (),
            ...(options.encoders ?? {})
        }

        this.cookieJar = new CookieJar ()

    }

    isAuthenticated () {

        return this.cookieJar.getCookie (this.auth.cookie) != null

    }

    getCookieHeader (url) {

        const {protocol, origin, pathname} = new URL (url)
        
        return this.cookieJar.getCookies (new CookieAccessInfo (origin, pathname, protocol.startsWith ('https')))
        
            .map (i => i.toValueString ())

                .join ('; ')

    }

    adjustHeaders (headers = {}, url) {

        const result = {}
        
        for (const [k, v] of Object.entries ({
            ...headers, 
            cookie: this.getCookieHeader (url)
        })) if (v) result [k] = v

        for (const [k, v] of Object.entries (this.headers)) if (!(k in result) && v) result [k] = v

        return result

    }

    stripContentType (s) {

        const pos = s.indexOf (';'); if (pos === -1) return s

        return s.substring (0, pos)

    }

    stringifyBody (body, contentType) {

        const enc = this.encoders [contentType]; if (!enc) throw Error (`Don't know how to stringify ${contentType}`)

        return enc (body)

    }

    async authenticate () {

        const {auth: {url, options, check}} = this

        check (await this.fetch (url, {...options, noAuth: true}))

    }

    async fetch (url, options = {}) {

        return new FetchRequst (this, url, options).perform ()

    }

    async fetchJson (url, options = {}) {

        const response = await this.fetch (url, options)

        const json = await response.json ()

        return json

    }

}

module.exports = CookieSessionClient