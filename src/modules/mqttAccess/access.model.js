const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  device: { type: mongoose.Schema.Types.ObjectId, ref: 'Device', required: true, index: true },
  username: { type: String, required: true, unique: true },
  clientId: { type: String, required: true },
  roleName: { type: String, required: true },
  permission: { type: String, enum: ['view', 'control', 'admin'], required: true },
  topicBase: { type: String, required: true },
  expiresAt: { type: Date, required: true, index: true },
  status: { type: String, enum: ['pending', 'active', 'revoking', 'revoked'], default: 'pending', index: true },
  revokedAt: Date,
  reason: String
}, { timestamps: true });
// Never TTL-delete a grant before its broker credentials have been removed.
const MqttAccess = mongoose.model('MqttAccess', schema);
const GuardState = mongoose.model('MqttAccessGuard', new mongoose.Schema({
  _id: String, checkedAt: Date, ready: Boolean
}));
module.exports = { MqttAccess, GuardState };
