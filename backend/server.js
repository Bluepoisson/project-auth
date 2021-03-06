import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import mongoose from 'mongoose';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import listEndpoints from 'express-list-endpoints';

const mongoUrl = process.env.MONGO_URL || 'mongodb://localhost/authAPI';
mongoose.connect(mongoUrl, { useNewUrlParser: true, useUnifiedTopology: true });
mongoose.set('useCreateIndex', true);
mongoose.Promise = Promise;

const userSchema = new mongoose.Schema({
	name: {
		type: String,
		unique: true,
		required: true,
		minLength: 3,
		maxLength: 20,
	},
	password: {
		type: String,
		required: true,
		minLength: 5,
	},
	accessToken: {
		type: String,
		default: () => crypto.randomBytes(128).toString('hex'),
	},
});

userSchema.pre('save', async function (next) {
	const user = this;

	if (!user.isModified('password')) {
		return next();
	}

	const salt = bcrypt.genSaltSync();
	user.password = bcrypt.hashSync(user.password, salt);
	next();
});

const User = mongoose.model('User', userSchema);

//! To do:
// if (process.env.RESET_DATABASE) {
//   console.log('Resetting database ...')

//   const seedDatabase = async () => {

//   }
//   seedDatabase()
// }

const port = process.env.PORT || 8080;
const app = express();

// Add middlewares to enable cors and json body parsing
app.use(cors());
app.use(bodyParser.json());

// ? Checking users access token in db, setting user in req so can be used in protected endpoint
const authenticateUser = async (req, res, next) => {
	try {
		const user = await User.findOne({
			accessToken: req.header('Authorization'),
		});

		if (user) {
			req.user = user;
			next();
		} else {
			res
				.status(401)
				.json({ loggedOut: true, message: 'Please try logging in again' });
		}
	} catch (err) {
		res.status(403).json({ message: 'Access denied', errors: err });
	}
};

// Start defining your routes here
app.get('/', (req, res) => {
	res.send(listEndpoints(app));
});

// ? SIGN UP - create user
app.post('/users', async (req, res) => {
	try {
		const { name, password } = req.body;

		const user = new User({ name, password });
		const newUser = await user.save();

		res
			.status(201)
			.json({ userId: newUser._id, accessToken: newUser.accessToken });
	} catch (err) {
		res.status(400).json({ message: 'Could not create user', errors: err });
	}
});

//? secure endpoint, user needs to be logged in to access this
app.get('/users/:id', authenticateUser);
app.get('/users/:id', (req, res) => {
	const secretMessage = `This is a secret message for ${req.user.name}`;
	console.log(`SecretMessage in endpoint ${secretMessage}`);

	res.status(200).json({ secretMessage });
	// res.status(201).json({ name: req.user.name, userId: req.user._id });
});

// ? LOGIN user and check password match user
app.post('/sessions', async (req, res) => {
	try {
		const { name, password } = req.body;
		console.log(`User :${user}`);
		const user = await User.findOne({ name });
		console.log(`accessToken: ${user.accessToken}`);
		console.log(`user_id :${user._id}`);
		if (user && bcrypt.compareSync(password, user.password)) {
			res.status(200).json({ userId: user._id, accessToken: user.accessToken });
		} else {
			res
				.status(401)
				.json({ message: 'Unvalid username or password', errors: err });
		}
	} catch (err) {
		res.status(400).json({ message: 'Could not log in', errors: err });
	}
});

// Start the server
app.listen(port, () => {
	console.log(`Server running on http://localhost:${port}`);
});
