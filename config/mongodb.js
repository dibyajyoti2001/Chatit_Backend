import mongoose from 'mongoose'

const connectDB = async () => {

    try {

        mongoose.connection.on('connected', () => {
            console.log("Connected to Database");
        })
    
        await mongoose.connect(`${process.env.MONGODB_URL}`)

    } catch(error) {
        console.log('Error connecting database: ', error.message)
        process.exit(1);
    }
}

export default connectDB;