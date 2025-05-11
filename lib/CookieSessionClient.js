const {randomUUID} = require ('crypto')
const os = require ('os')
const Path = require ('path')
const {Tracker} = require ('events-to-winston')
const FetchRequst = require ('./FetchRequst')
const CookieJar = require ('./CookieJar')

class CookieSessionClient {

    constructor (options = {}) {

        {
            const {logger} = options
            if (!logger) throw Error ('logger not set')
            this.logger = logger
        }

        {
            const {auth} = options; if (auth) {
                if (!auth.cookie) throw Error ('auth.cookie not set')
                this.auth = {
                    check: _ => true,
                    ...auth
                }
            }
        }

        this.newID              = options.newID              ?? randomUUID
        this.base               = options.base               ?? ''
        this.userAgent          = options.userAgent          ?? 'CookieSessionClient'
        this.defaultContentType = options.defaultContentType ?? 'application/json'
        this.timeout            = options.timeout
        this.logger             = options.logger
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

        this [Tracker.LOGGING_ID] = options.loggingId ?? this.userAgent

        this.cookieJar = new CookieJar ({
            path: options.path ?? Path.join (os.tmpdir (), this.userAgent + '.cookies'),
            ttl:  options.ttl
        })

    }

    isAuthenticated () {

        if (!this.auth) return true

        return this.cookieJar.get (this.auth.cookie) != null

    }

    adjustHeaders (headers = {}, url) {

        const result = {}
        
        for (const [k, v] of Object.entries ({
            ...headers, 
            cookie: this.cookieJar.getCookieHeader (url)
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

    async authenticate (pendingRequest) {

        const {auth: {url, options, check}} = this

        check (await this.fetch (url, {...options, noAuth: true, loggingParent: pendingRequest}))

    }

    async fetch (url, options = {}) {

        options.loggingId = this.newID ()

        return new FetchRequst (this, url, options).perform ()

    }

    async fetchJson (url, options = {}) {

        const response = await this.fetch (url, options)

        const json = await response.json ()

        return json

    }

}

module.exports = CookieSessionClient