const H_CONTENT_TYPE = 'content-type'

class Requst {

    constructor (client, url, options = {}) {

        this.client = client
        this.url = client.base + url
        this.options = options

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

        if (!client.isAuthenticated () && !options.noAuth) await client.authenticate ()

        this.adjustOptions ()

        await this.invoke ()

        client.cookieJar.setCookies (this.getSetCookie ())

//      client.headers.referer = url

        return this.result

    }

}

module.exports = Requst