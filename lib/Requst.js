const Path               = require ('node:path')
const EventEmitter       = require ('node:events')
const {Readable}         = require ('node:stream')
const {Tracker}          = require ('events-to-winston')
const contentDisposition = require ('content-disposition')
const mime               = require ('mime-types')

const H_CONTENT_TYPE        = 'content-type'
const H_CONTENT_DISPOSITION = 'content-disposition'

class Requst extends EventEmitter {

    constructor (client, url, options = {}) {

        super ()

        this.client = client

        this [Tracker.LOGGING_PARENT] = options.loggingParent ?? this.client
        this [Tracker.LOGGING_ID]     = this.id = client.newID ()

        this.url     = new URL (client.base + url)

        this.options = {}
        this.fileNameOptions = {}

        for (const [k, v] of Object.entries (options)) (k === 'useRemoteFileName' ? this.fileNameOptions : this.options) [k] = v

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

            warning: {level: 'info', message: _ => _},

            finish: {level: 'info', elapsed: true},

        }

    }    

    get contentType () {

        return this.options.headers [H_CONTENT_TYPE] ??= this.client.defaultContentType

    }

    get remoteFileName () {

        const v = this.response.headers.get (H_CONTENT_DISPOSITION); if (!v) return

        const {type, parameters} = contentDisposition.parse (v); if (type !== 'attachment' || !parameters) return

        return parameters.filename

    }

    get extNameByContentType () {

        const v = mime.extension (this.response.headers.get (H_CONTENT_TYPE))

        return v ? '.' + v : ''

    }

    get fileName () {

        let s

        if (this.fileNameOptions.useRemoteFileName ?? this.client.useRemoteFileName) s = this.remoteFileName

        if (!s) s = this.id

        if (!Path.extname (s)) s += this.extNameByContentType

        return s

    }

    get filePath () {

        return Path.join (this.client.dirFiles, this.fileName)
        
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

        if (options.noAuth) options.redirect = 'manual'

    }

    async perform () {

        const {client, url, options, tracker} = this

        tracker.listen ()

        if (!client.isAuthenticated () && !options.noAuth) await client.authenticate (this)

        this.adjustOptions ()

        try {

            this.emit ('start')

            this.response = await fetch (url, options)
    
            client.cookieJar.setCookies (this.response.headers.getSetCookie ())

        }
        catch (error) {

            this.emit ('error', this.error = error)

            throw error

        }

    }

    pipeBody (os) {

        const is = Readable.fromWeb (this.response.body)

        os.on ('error', error => this.emit ('error', error))
        is.on ('error', error => os.destroy (error))

        is.pipe (os)
        
    }

    async close () {

        try {

            const {response: {body}} = this; if (!body.locked) {

                this.emit ('warning', 'Forcibly draining body')

                for await (const _ of body);

            }

        }
        catch (error) {

            this.emit ('error', error)
            
        }
        finally {

            this.emit ('finish')

        }
        
    }

}

module.exports = Requst