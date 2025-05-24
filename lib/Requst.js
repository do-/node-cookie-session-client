const EventEmitter = require ('node:events')
const {Tracker} = require ('events-to-winston')

const H_CONTENT_TYPE = 'content-type'

class Requst extends EventEmitter {

    constructor (client, url, options = {}) {

        super ()

        this.client = client

        this [Tracker.LOGGING_PARENT] = options.loggingParent ?? this.client
        this [Tracker.LOGGING_ID]     = options.loggingId

        this.url     = new URL (client.base + url)
        this.options = options

        this.tracker = new Tracker (this, client.logger)

    }

    getLoggingOption (k) {

        const {options} = this; switch (k) {

            case 'method':
            case 'loggingId':
            case 'signal':
                return undefined

            case 'body':                                                        
                return this.originalBody ?? options.body

            default: 
                return options [k]

        }

    }

    get loggingDetails () {

        const o = {}; 
        
        for (const k in this.options) {

            const v = this.getLoggingOption (k)

            if (v !== undefined) o [k] = v

        }
                    
        return o

    }

    get [Tracker.LOGGING_EVENTS] () {
        return {
            start:  {
                level: 'info', 
                message: _ => `${this.options.method} ${this.url}`, 
                details: _ => this.loggingDetails
            },
            finish: {level: 'info', elapsed: true},
        }
    }    

    get contentType () {

        return this.options.headers [H_CONTENT_TYPE] ??= this.client.defaultContentType

    }

    adjustOptions () {

        const {client, url, options} = this

        options.headers = client.adjustHeaders (options.headers, url)

        {

            const {body} = options; if (body != null && typeof body === 'object') {

                this.originalBody = body
                    
                options.body = client.stringifyBody (body, this.contentType)

            }

        }

        if (!options.method) options.method = options.body ? 'POST' : 'GET'

        if (!options.signal) {

            const timeout = options.timeout ?? client.timeout

            if (timeout) options.signal = AbortSignal.timeout (1000 * timeout)

        }

    }

    async perform () {

        const {client, options} = this

        if (!client.isAuthenticated () && !options.noAuth) await client.authenticate (this)

        this.adjustOptions ()

        this.tracker.listen ()

        await this.invoke ()

        client.cookieJar.setCookies (this.response.headers.getSetCookie ())

    }

    async invoke () {

        const {url, options} = this

        if (options.noAuth) options.redirect = 'manual'

        try {

            this.emit ('start')
            this.response = await fetch (url, options)

        }
        catch (error) {

            this.emit ('error', this.error = error)

            throw error

        }
        finally {

            this.emit ('finish')

        }

    }

}

module.exports = Requst