const router = require('express').Router({ mergeParams: true });
const { param, body } = require('express-validator');
const rateLimit = require('express-rate-limit');
const auth = require('../../common/middleware/auth.middleware');
const validate = require('../../common/middleware/validate.middleware');
const wrap = require('../../common/utils/asyncHandler');
const send = require('../../common/utils/sendResponse');
const { AccessService } = require('./access.service');
const service = new AccessService();
router.use(auth, validate([param('deviceId').isMongoId()]));
router.use((req,res,next) => {res.set('Cache-Control','no-store'); next();});
router.use(rateLimit({ windowMs: 60000, limit: 20, keyGenerator: req => String(req.user._id),
  standardHeaders:true,legacyHeaders:false,message:{success:false,message:'Too many MQTT access requests'} }));
const noBody = validate([body().custom(value => value == null || Object.keys(value).length === 0)]);
router.post('/', noBody, wrap(async (req,res) => send(res,201,'MQTT access granted',{
  access: await service.issue(req.user._id, req.params.deviceId, req.authExpiresAt)
})));
router.post('/:sessionId/renew', validate([param('sessionId').isMongoId()]), noBody, wrap(async (req,res) => send(res,201,'MQTT access renewed',{
  access: await service.renew(req.user._id,req.params.deviceId,req.params.sessionId,req.authExpiresAt)
})));
router.delete('/:sessionId', validate([param('sessionId').isMongoId()]), wrap(async (req,res) => {
  await service.revoke(req.user._id,req.params.deviceId,req.params.sessionId);
  return send(res,200,'MQTT access revoked');
}));
module.exports = router;
