import mongoose from 'mongoose'

const { Schema } = mongoose

const userSchema = new Schema({
	firstName: String,
	lastName: String,
	githubUserName: String,
	email: String,
})
