import mongoose, { Document, Schema } from 'mongoose';

export interface ISession extends Document {
    userId: mongoose.Types.ObjectId;
    sessionId: string;
    expiresAt: Date;
    createdAt: Date;
    updatedAt: Date;
}

const SessionSchema = new Schema<ISession>(
    {
        userId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        sessionId: {
            type: String,
            required: true,
            unique: true,
        },
        expiresAt: {
            type: Date,
            required: true,
        },
    },
    { timestamps: true }
);

// Index to automatically expire sessions
SessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const SessionModel = () => mongoose.model<ISession>('sessions', SessionSchema)
export const Session = (mongoose.models['sessions'] || SessionModel()) as ReturnType<typeof SessionModel>