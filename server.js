require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const bodyParser = require('body-parser');

const bcrypt = require('bcrypt');
const crypto = require('crypto');
const path = require('path');

const app = express();

// Models
const Admin = require('./models/Admin');

const Student = mongoose.model('Student', {
  name: String,
  email: { type: String, unique: true },
  phone: String,
  course: String,
});

// DB & Middleware
// MongoDB
mongoose.connect(process.env.MONGO_URI);
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Sessions
app.use(session({
 secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
 store: MongoStore.create({ mongoUrl: process.env.MONGO_URI }),
}));


// Mailer
// const transporter = nodemailer.createTransport({
//   service: 'gmail',
//   auth: {
//     user: 'your_email@gmail.com',
//     pass: 'your_app_password',
//   },
// });

// Auth Middleware
function ensureAdmin(req, res, next) {
  if (req.session.isAdmin) return next();
  res.redirect('/admin/login');
}

app.get('/', (req, res) => {
  res.render('home');
});


// Routes
app.get('/register', (req, res) => {
  const courses = ['Web Design', 'Graphic Design', 'Microsoft Office Suite'];
  res.render('index', { courses }); // this is important
});


// Register Student with unique email
app.post('/register', async (req, res) => {
  const { name, email, phone, course } = req.body;

  const ghanaPhonePattern = /^(?:\+233|233|0)[235][0-9]{8}$/;

  if (!ghanaPhonePattern.test(phone)) {
    return res.send('Invalid Ghanaian phone number. Example: 0244123456 or +233244123456');
  }

  // Check if student already exists
  const existingStudent = await Student.findOne({ email });
  if (existingStudent) {
    return res.send('Email already registered');
  }

  // Save student
  const student = new Student({ name, email, phone, course });
  await student.save();

  res.render('success', { name }); // optional: pass name to show "Thank you, name"
});




app.get('/success', (req, res) => {
  const name = req.query.name;
  res.render('success', { name });
});


// // Example: Array of courses
// app.get('/register', (req, res) => {
//   const courses = ['Web Design', 'Graphic Design', 'Microsoft Office Suite', 'Data Science'];
//   res.render('index', { courses }); // Make sure you pass `courses` to the view
// });


// Admin Auth
app.get('/admin/login', (req, res) => res.render('admin-login', { error: null }));

app.post('/admin/login', async (req, res) => {
  const { email, password } = req.body;
  console.log('🔐 Admin login attempt');
  console.log(req.body);

  try {
    const admin = await Admin.findOne({ email });

    if (!admin) {
      return res.render('admin-login', { error: 'Invalid email' });
    }

    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) {
      return res.render('admin-login', { error: 'Incorrect password' });
    }

    // ✅ Login success
    req.session.isAdmin = true;
    req.session.admin = admin._id;

    console.log('✅ Admin logged in');
    return res.redirect('/admin');
  } catch (err) {
    console.error('❌ Login error:', err);
    return res.render('admin-login', { error: 'Something went wrong' });
  }
});



app.get('/admin', ensureAdmin, async (req, res) => {
 try {
    // Fetch all students
    const students = await Student.find();

    // Group students by course and count the number of students in each course
    const courseCounts = students.reduce((acc, student) => {
      if (acc[student.course]) {
        acc[student.course] += 1;
      } else {
        acc[student.course] = 1;
      }
      return acc;
    }, {});

    // Extract course names and counts into separate arrays
    const courses = Object.keys(courseCounts);
    const counts = Object.values(courseCounts);

    // Render the admin dashboard with courses and counts
    res.render('admin', { students, courses, counts });
  } catch (err) {
    console.log(err);
    res.status(500).send('Error fetching data');
  }
});


app.get('/admin/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/admin/login'));
});

// Forgot Password
app.get('/admin/forgot', (req, res) => res.render('admin-forgot', { error: null }));

app.post('/admin/forgot', async (req, res) => {
  const { email } = req.body;
  const admin = await Admin.findOne({ email });

  if (!admin) return res.render('admin-forgot', { error: 'Email not found' });

  const token = crypto.randomBytes(32).toString('hex');
  admin.resetToken = token;
  admin.resetTokenExpire = Date.now() + 3600000;
  await admin.save();

  const link = `http://localhost:3000/admin/reset/${token}`;

  await transporter.sendMail({
    to: email,
    from: 'your_email@gmail.com',
    subject: 'Password Reset',
    html: `Click to reset password: <a href="${link}">${link}</a>`,
  });

  res.send('Reset link sent to your email.');
});

app.get('/admin/reset/:token', async (req, res) => {
  const admin = await Admin.findOne({
    resetToken: req.params.token,
    resetTokenExpire: { $gt: Date.now() },
  });

  if (!admin) return res.send('Invalid or expired reset link.');

  res.render('admin-reset', { token: req.params.token });
});

app.post('/admin/reset/:token', async (req, res) => {
  const admin = await Admin.findOne({
    resetToken: req.params.token,
    resetTokenExpire: { $gt: Date.now() },
  });

  if (!admin) return res.send('Invalid or expired reset link.');

  admin.password = req.body.password;
  admin.resetToken = undefined;
  admin.resetTokenExpire = undefined;
  await admin.save();

  res.send('Password reset successful. You can now log in.');
});

// Optional: Create first admin
app.get('/create-admin', async (req, res) => {
  const existing = await Admin.findOne({ email: 'admin@example.com' });
  if (!existing) {
    const hashedPassword = await bcrypt.hash('admin123', 12);
    const admin = new Admin({
      username: 'Admin',
      email: 'admin@example.com',
      password: hashedPassword
    });
    await admin.save();
    console.log('✅ Admin created');
    res.send('Admin created');
  } else {
    console.log('ℹ️ Admin already exists');
    res.send('Admin already exists');
  }
});

// Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Running at http://localhost:${PORT}`));
