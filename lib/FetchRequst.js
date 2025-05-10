const Requst = require ('./Requst')

class FetchRequst extends Requst {

    async invoke () {

        const {url, options} = this

        if (options.noAuth) options.redirect = 'manual'

        this.result = await fetch (url, options)

    }

    getSetCookie () {

        return this.result.headers.getSetCookie ()

    }

}

module.exports = FetchRequst