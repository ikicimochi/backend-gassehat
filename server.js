/*
 * server.js – GasSehat backend
 * Siap dideploy ke Railway
 */

const express = require("express");
const cors = require("cors");
const path = require("path");

const db = require("./db");

const app = express();
const PORT = process.env.PORT || 5000; // Railway menginjeksi PORT

// ---------- MIDDLEWARE ----------
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public"))); // opsional jika ada file statis

// ---------- ROOT & HEALTH ----------
app.get("/", (req, res) => {
  res.send("🚀 GasSehat backend is online");
});

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// ---------- AUTH ----------
app.post("/api/register", (req, res) => {
  const { username, password } = req.body;
  try {
    const existing = db
      .prepare("SELECT 1 FROM pasien WHERE username = ?")
      .get(username);
    if (existing)
      return res.status(400).json({ message: "Username sudah terdaftar" });

    db.prepare("INSERT INTO pasien (username, password) VALUES (?, ?)").run(
      username,
      password
    );
    res.json({ message: "Registrasi berhasil" });
  } catch (err) {
    res.status(500).json({ message: "Gagal registrasi", error: err.message });
  }
});

app.post("/api/login", (req, res) => {
  const { username, password } = req.body;
  try {
    const user = db
      .prepare("SELECT 1 FROM pasien WHERE username = ? AND password = ?")
      .get(username, password);
    if (!user)
      return res.status(401).json({ message: "Username atau password salah" });

    // Di production ganti dengan JWT sesungguhnya
    res.json({ message: "Login berhasil", token: "fake-jwt-token" });
  } catch (err) {
    res.status(500).json({ message: "Gagal login", error: err.message });
  }
});

// ---------- DOCTORS & SCHEDULES ----------
app.get("/api/doctors", (req, res) => {
  try {
    const doctors = db.prepare("SELECT * FROM dokter").all();
    res.json(doctors);
  } catch (err) {
    res.status(500).json({ error: "Gagal mengambil daftar dokter" });
  }
});

app.post("/api/doctors", (req, res) => {
  try {
    const { nama, poli } = req.body;
    if (!nama || !poli)
      return res.status(400).json({ error: "Nama dan poli wajib diisi" });

    const { lastInsertRowid } = db
      .prepare("INSERT INTO dokter (nama, poli) VALUES (?, ?)")
      .run(nama, poli);
    res.json({ id: lastInsertRowid, nama, poli });
  } catch (err) {
    res.status(500).json({ error: "Gagal menambahkan dokter" });
  }
});

app.get("/api/doctors/:id/schedules", (req, res) => {
  try {
    const { id } = req.params;
    const rows = db
      .prepare("SELECT hari, shift FROM jadwal_dokter WHERE dokter_id = ?")
      .all(id);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Gagal mengambil jadwal dokter" });
  }
});

app.post("/api/doctors/:id/schedules", (req, res) => {
  try {
    const { id } = req.params;
    const { hari, shift } = req.body;
    if (!hari || !shift)
      return res.status(400).json({ error: "Hari dan shift wajib diisi" });

    const exist = db
      .prepare("SELECT 1 FROM jadwal_dokter WHERE dokter_id = ? AND hari = ?")
      .get(id, hari);

    if (exist) {
      db.prepare(
        "UPDATE jadwal_dokter SET shift = ? WHERE dokter_id = ? AND hari = ?"
      ).run(shift, id, hari);
    } else {
      db.prepare(
        "INSERT INTO jadwal_dokter (dokter_id, hari, shift) VALUES (?, ?, ?)"
      ).run(id, hari, shift);
    }
    res.json({ message: "Jadwal berhasil disimpan" });
  } catch (err) {
    res.status(500).json({ error: "Gagal menyimpan jadwal" });
  }
});

// ---------- PATIENT VIEW ----------
app.get("/api/dokter", (req, res) => {
  try {
    const { poli, hari } = req.query;
    if (!poli || !hari)
      return res
        .status(400)
        .json({ error: "Parameter 'poli' dan 'hari' diperlukan" });

    const rows = db
      .prepare(
        `
      SELECT d.id, d.nama AS Nama, jd.shift AS Shift
      FROM dokter d
      JOIN jadwal_dokter jd ON d.id = jd.dokter_id
      WHERE d.poli = ? AND jd.hari = ?
    `
      )
      .all(poli, hari);

    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.get("/api/jadwal-dokter", (req, res) => {
  try {
    const rows = db
      .prepare(
        `
      SELECT d.id AS dokter_id, d.nama, d.poli, jd.hari, jd.shift
      FROM dokter d
      JOIN jadwal_dokter jd ON d.id = jd.dokter_id
      ORDER BY d.id, jd.hari
    `
      )
      .all();

    const result = [];
    for (const row of rows) {
      let dokter = result.find((d) => d.nama === row.nama);
      if (!dokter) {
        dokter = { nama: row.nama, poli: row.poli, jadwal: [] };
        result.push(dokter);
      }
      dokter.jadwal.push({ hari: row.hari, shift: row.shift });
    }

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: "Gagal mengambil jadwal dokter" });
  }
});

// ---------- OBAT ----------
app.get("/api/obat", (req, res) => {
  try {
    const rows = db.prepare("SELECT * FROM obat").all();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Gagal mengambil data obat" });
  }
});

// ---------- START ----------
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
