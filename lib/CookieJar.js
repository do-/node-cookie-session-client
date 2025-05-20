const fs = require ('node:fs')
const EventEmitter = require ('node:events')
const Cookie = require ('./Cookie')

const EV_DELETE = 'delete'
const EV_INSERT = 'insert'
const EV_UPDATE = 'update'

class CookieJar extends EventEmitter {

    constructor (options = {}) {

        super ()

        this.path = options.path
        this.ttl  = options.ttl * 60 * 1000 || Infinity

        this.idx = {}
        this.reset ()
        
        const onChange = () => this.isChanged = true

        this.on (EV_DELETE, onChange)
        this.on (EV_INSERT, onChange)
        this.on (EV_UPDATE, onChange)

        this.load ()

    }

    reset () {

        this.isChanged = false

    }
    
    del (name) {

        const {idx} = this; if (!(name in idx)) return

        delete idx [name]

        this.emit (EV_DELETE, name)

    }

    get (name) {

        const {idx} = this, cookie = idx [name]

        if (!cookie || !cookie.isExpired) return cookie

        this.del (name)

    }

    parse (src) {

        const cookie = new Cookie (src), {name} = cookie, {idx} = this

        const event = 
            !(name in idx)             ? EV_INSERT :
            cookie.isExpired           ? EV_DELETE :
            cookie.equals (idx [name]) ? null : 
            EV_UPDATE

        if (!event) return

        if (event === EV_DELETE) return this.del (name)

        idx [name] = cookie

        this.emit (event, name)

    }

    setCookies (lines) {

        for (const line of lines) this.parse (line)

    }

    * [Symbol.iterator] () {

        const {idx} = this; for (const name in idx) {

            const cookie = this.get (name)

            if (cookie) yield cookie

        }

    }

    getCookieHeader (href) {

        const url = new URL (href)

        let s = ''; for (const cookie of this) if (cookie.match (url)) {

            if (s) s += '; '

            s += cookie

        }

        this.save ()

        return s
        
    }

    load () {

        const {path} = this

        const stat = fs.statSync (path, {throwIfNoEntry: false}); if (!stat) return

        if ((Date.now () - stat.mtimeMs) > this.ttl) return fs.rmSync (path)

        this.setCookies (fs.readFileSync (this.path, {encoding: 'utf8'}).split ('\n'))

        this.reset ()

    }

    save (force = false) {

        if (!this.isChanged && !force) return

        const {path} = this

        let s = ''; for (const cookie of this) s += cookie + '\n'

        if (s) {

            fs.writeFileSync (path, s.trimEnd (), {encoding: 'utf8'})

        }
        else if (fs.existsSync (path)) {

            fs.rmSync (path)

        }

        this.reset ()

    }

    empty () {

        this.idx = {}
        
        this.save (true)

    }

}

module.exports = CookieJar