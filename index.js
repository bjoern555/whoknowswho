const express = require('express')
const fs = require('fs')
const os = require('os')
const app = express()

function getLocalIP() {
  const all = []
  for (const ifaces of Object.values(os.networkInterfaces())) {
    for (const iface of ifaces) {
      if (iface.family === 'IPv4' && !iface.internal) all.push(iface.address)
    }
  }
  // prefer home/office WiFi ranges over VM/Docker subnets
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
  if (!fs.existsSync(DB_FILE)) return { people: [], activities: [] }
  const data = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'))
  if (!data.activities) data.activities = []
  return data
}

function writeDB(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2))
}

app.post('/api/register', (req, res) => {
  const { name, color, emoji } = req.body
  if (!name) return res.json({ message: 'Name is required' })

  const db = readDB()
  const exists = db.people.find(p => p.name.toLowerCase() === name.toLowerCase())
  if (exists) return res.json({ message: `Welcome back, ${name}!`, id: exists.id, color: exists.color, emoji: exists.emoji })

  const newPerson = { id: Date.now().toString(), name, color: color || '#4a90d9', emoji: emoji || '', knows: [] }
  db.people.push(newPerson)
  writeDB(db)

  res.json({ message: `Welcome, ${name}! You are registered.`, id: newPerson.id })
})

app.patch('/api/people/:id', (req, res) => {
  const { color, emoji } = req.body
  const db = readDB()
  const person = db.people.find(p => p.id === req.params.id)
  if (!person) return res.status(404).json({ error: 'Not found' })
  if (color) person.color = color
  if (emoji !== undefined) person.emoji = emoji
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

app.get('/api/activities', (req, res) => {
  const db = readDB()
  res.json({ activities: db.activities })
})

app.post('/api/activities', (req, res) => {
  const { fromId, title, description, location } = req.body
  if (!fromId || !title) return res.status(400).json({ error: 'fromId and title required' })
  const db = readDB()
  if (!db.people.find(p => p.id === fromId)) return res.status(404).json({ error: 'Person not found' })
  const activity = { id: Date.now().toString(), fromId, title, description: description || '', location: location || '', joiners: [fromId] }
  db.activities.push(activity)
  writeDB(db)
  res.json({ ok: true, id: activity.id })
})

app.post('/api/activities/:id/join', (req, res) => {
  const { userId } = req.body
  const db = readDB()
  const activity = db.activities.find(a => a.id === req.params.id)
  if (!activity) return res.status(404).json({ error: 'Not found' })
  const idx = activity.joiners.indexOf(userId)
  if (idx === -1) activity.joiners.push(userId)
  else activity.joiners.splice(idx, 1)
  writeDB(db)
  res.json({ ok: true, joined: idx === -1 })
})

app.delete('/api/activities/:id', (req, res) => {
  const { userId } = req.body
  const db = readDB()
  const activity = db.activities.find(a => a.id === req.params.id)
  if (!activity) return res.status(404).json({ error: 'Not found' })
  if (activity.fromId !== userId) return res.status(403).json({ error: 'Not your activity' })
  db.activities = db.activities.filter(a => a.id !== req.params.id)
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
