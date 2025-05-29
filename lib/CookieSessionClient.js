const {randomUUID} = require ('node:crypto')
const fs           = require ('node:fs')
const os           = require ('node:os')
const Path         = require ('node:path')
const {Tracker}    = require ('events-to-winston')
const {CookieJar}  = require ('tin-cookie-jar')

const CONTENT_TYPE_JSON = 'application/json'

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

        this.userAgent  = options.userAgent ?? 'CookieSessionClient'

        this.dir        = options.dir       ?? Path.join (os.tmpdir (), this.userAgent)
        fs.mkdirSync (this.dir, {recursive: true})

        this.dirFiles   = options.dirFiles  ?? Path.join (this.dir, 'files')
        fs.mkdirSync (this.dirFiles, {recursive: true})

        this.cookieJar = new CookieJar ({
            path: Path.join (this.dir, options.fileNameCookies ?? 'cookies.txt'),
            ttl:  options.ttl
        })

        this.dispatcher         = options.dispatcher
        this.base               = options.base               ?? this.getDefaultBase ()

        this.fileDownloadOptions = {}
        this.fileDownloadOptions.useRemoteFileName = options.useRemoteFileName ?? true
        this.fileDownloadOptions.progressInterval  = options.progressInterval  ?? 1000

        this.newID              = options.newID              ?? randomUUID
        this.defaultContentType = options.defaultContentType ?? CONTENT_TYPE_JSON
        this.timeout            = options.timeout
        this.logger             = options.logger
        this.headers            = {
            ...this.getDefaultHeaders (),
            ...(options.headers ?? {}),
        }

        this.encoders = {
            [CONTENT_TYPE_JSON]: body => JSON.stringify (body),
            'application/x-www-form-urlencoded': body => new URLSearchParams (body).toString (),
            ...(options.encoders ?? {})
        }

        this [Tracker.LOGGING_ID] = options.loggingId ?? this.userAgent

        this.requstClass        = options.requstClass || require ('./Requst')

    }

    getDefaultBase () {

        const {kUrl} = require ('undici/lib/core/symbols.js')

        if (this.dispatcher && kUrl in this.dispatcher) return this.dispatcher [kUrl].origin

        return ''

    }

    getDefaultHeaders () {

        return {
            "accept": "*/*",
            "accept-encoding": "gzip, deflate, br, zstd",
            "origin": this.base,
            "user-agent": this.userAgent,
        }

    }

    isAuthenticated () {

        if (!this.auth) return true

        return this.cookieJar.get (this.auth.cookie) != null

    }

    adjustHeaders (headers = {}, url) {

        const result = structuredClone (headers)

        if (!('cookie' in result)) result.cookie = this.cookieJar.getCookieHeader (url)
        
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

        const request = await this.makeRequest (url, {...options, noAuth: true, loggingParent: pendingRequest})

        try {

            check (request.response)

        }
        finally {

            await request.close ()

        }

    }

    isUnauthorized ({status}) {

        return status == 401 || status == 403

    }

    async makeRequest (url, options, fileDownloadOptions) {
        
        for (let i = 0; i < 2; i ++) {

            const request = new this.requstClass (this, url, options, fileDownloadOptions)

            await request.perform ()

            if (!this.isUnauthorized (request.response)) return request

            this.cookieJar.clear ()

        }

        throw Error ('Kicked out, failed to log in back')

    }

    async fetchJson (url, options = {}) {

        options.headers        ??= {}
        options.headers.accept ??= CONTENT_TYPE_JSON

        const request = await this.makeRequest (url, options)

        try {

            return request.response.json ()

        }
        finally {

            await request.close ()

        }

    }

    async fetchText (url, options = {}) {

        const request = await this.makeRequest (url, options)

        try {

            return request.response.text ()

        }
        finally {

            await request.close ()

        }

    }

    async fetchFile (url, rawOptions = {}) {

        const options = {}, fileDownloadOptions = structuredClone (this.fileDownloadOptions)

        for (const [k, v] of Object.entries (rawOptions)) (k in fileDownloadOptions ? fileDownloadOptions : options) [k] = v

        const request = await this.makeRequest (url, options, fileDownloadOptions)

        const {filePath} = request

        const os = fs.createWriteStream (filePath)

        try {

            await new Promise ((ok, fail) => {

                os.on ('error', fail)
                os.on ('close', ok)

                request.pipeBody (os)

            })

            return filePath

        }
        finally {

            request.close ()

        }

    }

}

module.exports = CookieSessionClient