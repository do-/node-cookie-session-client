const FIELDS = [
    'Domain',
    'Expires',
    'Secure',
    'Path',
].map (s => [s.toLowerCase (), s])

class Cookie {

    constructor (src) {

        this.src = src

        if (typeof src !== 'string') throw Error ('Invalid cookie source: ' + src)

        const {length} = src

        if (length < 3 || length > 32768) throw Error ('Invalid cookie source length: ' + length)

		let from = 0, to = 0; while (to < length) {

			to = src.indexOf (';', from); if (to < 0) break
            
            this.parsePart (src.slice (from, to).trim ())

			from = ++ to

		}
        
    }

    parsePart1 (part) {

        if (!this.kv) throw Error ('Invalid set-cookie: ' + src)

        if (part.toLowerCase () === 'secure') this.secure = true

    }

    setOption (name, value) {

        switch (name) {

            case 'domain':
            case 'path':
                this [name] = value
                break

            case 'expires':
                const ts = Date.parse (value); if (!isNaN (ts)) this.expires = ts
                break

            case 'max-age':
                const ttl = parseInt (value); if (!isNaN (ttl)) this.expires = Date.now () + 1000 * ttl
                break

        }

    }

    get isExpired () {

        if (this.kv.length === this.name.length + 1) return true

        if (isNaN (this.expires)) return false

        return this.expires < Date.now ()

    }

    equals (old) {

        for (const k of ['kv', 'expires']) if (this [k] != old [k]) return false

        return true

    }

    match ({protocol, origin, pathname}) {

        if (this.secure && !protocol.startsWith ('https')) return false

        if (this.domain && !origin.endsWith (this.domain)) return false

        if (this.path && !pathname.startsWith (this.path)) return false

        return true

    }

    parsePart (part) {

		const posEq = part.indexOf ('='); if (posEq === -1) return this.parsePart1 (part)

        const name = part.substring (0, posEq), value = part.slice (posEq + 1)

        if (this.kv) return this.setOption (name.toLowerCase (), value)

        this.kv    = part
        this.name  = name

    }

    get value () {

        return this.decodeURIComponent (this.kv.substring (this.name.length + 1))

    }

    toString () {

        let s = this.kv; for (const [lc, cc] of FIELDS) {

            let v = this [lc]; if (!v) continue

            s += `; ${cc}`

            if (lc === 'secure') continue

            if (lc === 'expires') v = new Date (v).toDateString ()

            s += `=${v}`

        }

        return s

    }

}

module.exports = Cookie