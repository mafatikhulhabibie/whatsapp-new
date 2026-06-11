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
export default class ChatConversation extends BaseModel {
}
__decorate([
    column({ isPrimary: true }),
    __metadata("design:type", Number)
], ChatConversation.prototype, "id", void 0);
__decorate([
    column(),
    __metadata("design:type", Number)
], ChatConversation.prototype, "deviceId", void 0);
__decorate([
    column(),
    __metadata("design:type", String)
], ChatConversation.prototype, "chatJid", void 0);
__decorate([
    column(),
    __metadata("design:type", Boolean)
], ChatConversation.prototype, "isGroup", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], ChatConversation.prototype, "name", void 0);
__decorate([
    column(),
    __metadata("design:type", Object)
], ChatConversation.prototype, "lastMessagePreview", void 0);
__decorate([
    column.dateTime(),
    __metadata("design:type", Object)
], ChatConversation.prototype, "lastMessageAt", void 0);
__decorate([
    column(),
    __metadata("design:type", Number)
], ChatConversation.prototype, "unreadCount", void 0);
__decorate([
    column.dateTime({ autoCreate: true }),
    __metadata("design:type", DateTime)
], ChatConversation.prototype, "createdAt", void 0);
__decorate([
    column.dateTime({ autoCreate: true, autoUpdate: true }),
    __metadata("design:type", DateTime)
], ChatConversation.prototype, "updatedAt", void 0);
__decorate([
    belongsTo(() => Device),
    __metadata("design:type", Object)
], ChatConversation.prototype, "device", void 0);
