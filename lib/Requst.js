const EventEmitter = require ('node:events')
const {Tracker} = require ('events-to-winston')

const H_CONTENT_TYPE = 'content-type'

class Requst extends EventEmitter {

    constructor (client, url, options = {}) {

        super ()

        this.client = client

        this [Tracker.LOGGING_PARENT] = options.loggingParent ?? this.client
        this [Tracker.LOGGING_ID]     = options.loggingId

        this.url     = client.base + url
        this.options = options

        this.tracker = new Tracker (this, client.logger)

    }

    get [Tracker.LOGGING_EVENTS] () {
        return {
            start:  {level: 'info', message: '>', details: function () {
                const {url, options} = this
                return {url, options}
            }},
            finish: {level: 'info', message: '<', elapsed: true, details: {options: {}}},
        }
    }    

    adjustOptions () {

        const {client, url, options} = this

        options.headers = client.adjustHeaders (options.headers, url)

        if (options.body) {

            if (!options.headers [H_CONTENT_TYPE]) options.headers [H_CONTENT_TYPE] = client.defaultContentType

            if (typeof options.body === 'object') options.body = client.stringifyBody (options.body, options.headers [H_CONTENT_TYPE])

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

        client.cookieJar.setCookies (this.getSetCookie ())

        return this.result

    }

}

module.exports = Requst