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

    stringifyBody (body, contentType) {

        if (contentType.startsWith ('application/json')) return JSON.stringify (body)

        if (contentType === 'application/x-www-form-urlencoded') return new URLSearchParams (body).toString ()

        throw Error (`Don't know how to stringify ${contentType}`)

    }

    async authenticate () {

        const {auth: {url, options, check}} = this

        check (await this.fetch (url, {...options, noAuth: true}))

    }

    async fetch (url, options = {}) {

        return new FetchRequst (this, url, options).perform ()

    }

}

module.exports = CookieSessionClient