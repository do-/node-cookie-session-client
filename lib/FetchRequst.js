const Requst = require ('./Requst')

class FetchRequst extends Requst {

    async invoke () {

        const {url, options} = this

        if (options.noAuth) options.redirect = 'manual'

        try {

            this.emit ('start')
            this.result = await fetch (url, options)

        }
        catch (error) {

            this.emit ('error', error)

            throw error

        }
        finally {

            this.emit ('finish')

        }

    }

    getSetCookie () {

        return this.result.headers.getSetCookie ()

    }

}

module.exports = FetchRequst