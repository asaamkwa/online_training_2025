const mongoose = require('mongoose');
const Admin = require('./models/Admin');

const mongoURI = 'mongodb+srv://akaabadeklouis25:Sj8Nmog1zRvSpScQ@cluster1.z0tzpzz.mongodb.net/?retryWrites=true&w=majority&appName=Cluster1';

mongoose.connect(mongoURI)
  .then(async () => {
    let admin = await Admin.findOne({ email: 'admin@example.com' });

    if (!admin) {
      // Create the admin if not found
      admin = new Admin({
        username: 'admin',
        email: 'admin@example.com',
        password: 'admin123',
      });
      await admin.save();
      console.log('✅ Admin created with password admin123');
    } else {
      // Reset the password if admin exists
      admin.password = 'admin123';
      await admin.save();
      console.log('✅ Password reset to admin123');
    }

    mongoose.disconnect();
  })
  .catch(err => {
    console.error('❌ Connection error:', err.message);
  });
