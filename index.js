const express = require('express')
const fs = require('node:fs')
const os = require('node:os')
const app = express()

function getLocalIP() {
  const all = []
  for (const ifaces of Object.values(os.networkInterfaces())) {
    for (const iface of ifaces) {
      if (iface.family === 'IPv4' && !iface.internal) all.push(iface.address)
    }
  }
  return all.find(ip => ip.startsWith('192.168.1.'))
      || all.find(ip => ip.startsWith('192.168.'))
      || all.find(ip => ip.startsWith('10.'))
      || all[0]
      || 'localhost'
}

app.use(express.static('public'))
app.use(express.json())

const DB_FILE = 'db.json'

function readDB() {
  if (!fs.existsSync(DB_FILE)) return { people: [], publicUrl: '', messages: [] }
  const data = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'))
  if (!data.publicUrl) data.publicUrl = ''
  if (!data.messages) data.messages = []
  return data
}

function writeDB(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2))
}

app.post('/api/register', (req, res) => {
  const { name, color, emoji, drunkLevel } = req.body
  if (!name) return res.json({ message: 'Name is required' })

  const db = readDB()
  const exists = db.people.find(p => p.name.toLowerCase() === name.toLowerCase())
  if (exists) {
    if (drunkLevel !== undefined && drunkLevel !== null) {
      exists.drunkLevel = drunkLevel
      writeDB(db)
    }
    return res.json({ message: `Welcome back, ${name}!`, id: exists.id, color: exists.color, emoji: exists.emoji, drunkLevel: exists.drunkLevel ?? null })
  }

  const newPerson = { id: Date.now().toString(), name, color: color || '#4a90d9', emoji: emoji || '', drunkLevel: drunkLevel ?? null, knows: [] }
  db.people.push(newPerson)
  writeDB(db)

  res.json({ message: `Welcome, ${name}! You are registered.`, id: newPerson.id })
})

app.patch('/api/people/:id', (req, res) => {
  const { color, emoji, drunkLevel } = req.body
  const db = readDB()
  const person = db.people.find(p => p.id === req.params.id)
  if (!person) return res.status(404).json({ error: 'Not found' })
  if (color) person.color = color
  if (emoji !== undefined) person.emoji = emoji
  if (drunkLevel !== undefined) person.drunkLevel = drunkLevel
  writeDB(db)
  res.json({ ok: true })
})

app.get('/api/people', (req, res) => {
  const db = readDB()
  res.json({ people: db.people })
})

app.get('/api/people/:id', (req, res) => {
  const db = readDB()
  const person = db.people.find(p => p.id === req.params.id)
  if (!person) return res.status(404).json({ error: 'Not found' })
  res.json(person)
})

app.post('/api/know', (req, res) => {
  const { fromId, toId, knows } = req.body
  const db = readDB()
  const person = db.people.find(p => p.id === fromId)
  if (!person) return res.status(404).json({ error: 'Not found' })

  if (knows && !person.knows.includes(toId)) {
    person.knows.push(toId)
  } else if (!knows) {
    person.knows = person.knows.filter(id => id !== toId)
  }

  writeDB(db)
  res.json({ ok: true })
})

const PORT = 3001
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
  console.log(`Network:   http://${getLocalIP()}:${PORT}`)
})

app.get('/api/url', (req, res) => {
  res.json({ url: `http://${getLocalIP()}:${PORT}` })
})

app.get('/api/messages', (req, res) => {
  const db = readDB()
  res.json({ messages: db.messages })
})

app.post('/api/messages', (req, res) => {
  const { fromId, text } = req.body
  if (!fromId || !text) return res.status(400).json({ error: 'fromId and text required' })
  const db = readDB()
  if (!db.people.some(p => p.id === fromId)) return res.status(403).json({ error: 'Not registered' })
  const msg = { id: Date.now().toString(), fromId, text: text.slice(0, 500) }
  db.messages.push(msg)
  writeDB(db)
  res.json({ ok: true, message: msg })
})

app.get('/api/config', (req, res) => {
  const db = readDB()
  res.json({ publicUrl: db.publicUrl })
})

app.post('/api/config', (req, res) => {
  const { publicUrl } = req.body
  const db = readDB()
  db.publicUrl = publicUrl || ''
  writeDB(db)
  res.json({ ok: true })
})
