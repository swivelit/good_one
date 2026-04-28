const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
{
name: { type: String, required: true, trim: true },

email: {
type: String,
unique: true,
sparse: true,
lowercase: true,
trim: true
},

phone: {
type: String,
unique: true,
sparse: true,
trim: true
},

password: {
type: String,
required: true,
minlength: 6
},

role: {
type: String,
enum: ['customer','vendor'],
default: 'customer'
},

avatar: {
type: String,
default: ''
},

isActive: {
type: Boolean,
default: true
}

},
{ timestamps: true }
);



// HASH PASSWORD
userSchema.pre('save', async function () {

if (!this.isModified('password')) return;

this.password = await bcrypt.hash(this.password, 12);

});



// COMPARE PASSWORD
userSchema.methods.matchPassword = async function (enteredPassword) {

return await bcrypt.compare(enteredPassword, this.password);

};

module.exports = mongoose.model('User', userSchema);