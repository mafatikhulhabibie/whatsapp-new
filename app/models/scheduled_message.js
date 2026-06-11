var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { DateTime } from 'luxon';
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm';
import Device from '#models/device';
import User from '#models/user';
export default class ScheduledMessage extends BaseModel {
    static MAX_ATTEMPTS = 10;
}
__decorate([
    column({ isPrimary: true }),
    __metadata("design:type", Number)
], ScheduledMessage.prototype, "id", void 0);
__decorate([
    column(),
    __metadata("design:type", Number)
], ScheduledMessage.prototype, "userId", void 0);
__decorate([
    column(),
    __metadata("design:type", Number)
], ScheduledMessage.prototype, "deviceId", void 0);
__decorate([
    column(),
    __metadata("design:type", String)
], ScheduledMessage.prototype, "to", void 0);
__decorate([
    column(),
    __metadata("design:type", String)
], ScheduledMessage.prototype, "messageType", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], ScheduledMessage.prototype, "payload", void 0);
__decorate([
    column.dateTime(),
    __metadata("design:type", DateTime)
], ScheduledMessage.prototype, "scheduledAt", void 0);
__decorate([
    column(),
    __metadata("design:type", String)
], ScheduledMessage.prototype, "status", void 0);
__decorate([
    column(),
    __metadata("design:type", Number)
], ScheduledMessage.prototype, "attempts", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], ScheduledMessage.prototype, "error", void 0);
__decorate([
    column.dateTime(),
    __metadata("design:type", Object)
], ScheduledMessage.prototype, "sentAt", void 0);
__decorate([
    column.dateTime({ autoCreate: true }),
    __metadata("design:type", DateTime)
], ScheduledMessage.prototype, "createdAt", void 0);
__decorate([
    column.dateTime({ autoCreate: true, autoUpdate: true }),
    __metadata("design:type", DateTime)
], ScheduledMessage.prototype, "updatedAt", void 0);
__decorate([
    belongsTo(() => Device),
    __metadata("design:type", Object)
], ScheduledMessage.prototype, "device", void 0);
__decorate([
    belongsTo(() => User),
    __metadata("design:type", Object)
], ScheduledMessage.prototype, "user", void 0);
