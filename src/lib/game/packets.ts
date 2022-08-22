import {ClientEvent, InitData, Packet, Actor} from "./types";
import {Const} from "./config";
import {decodeRLE, encodeRLE} from "../utils/rle";

const _packU8 = new Uint8Array(2048);
const _packU32 = new Uint32Array(_packU8.buffer);
const _packF32 = new Float32Array(_packU8.buffer);
const _rleBuffer = new Uint8Array(2048);

export function unpack(data: ArrayBuffer): Packet {
    const u32 = Const.RLE ? _packU32 : new Uint32Array(data);
    const f32 = Const.RLE ? _packF32 : new Float32Array(data);
    if (Const.RLE) {
        decodeRLE(new Uint8Array(data), data.byteLength, _packU8);
    }

    let ptr = 0;
    const packet: Packet = {
        sync_: u32[ptr++] !== 0,
        c: u32[ptr++],
        receivedOnSender_: u32[ptr++],
        t: u32[ptr++],
        e: []
    };
    const eventsCount = u32[ptr++];
    let event_t = u32[ptr++];
    const hasInit = u32[ptr++];
    for (let i = 0; i < eventsCount; ++i) {
        const e: ClientEvent = {
            t: event_t++,
        };
        const flags = u32[ptr++];
        const hasBtn = flags & 1;
        const hasSpawn = flags & 2;
        const hasClientID = flags & 4;
        if (hasBtn) {
            e.btn_ = u32[ptr++];
        }
        if (hasSpawn) {
            e.spawn_ = {
                x: f32[ptr++],
                y: f32[ptr++],
                z: f32[ptr++],
            };
        }
        e.c = hasClientID ? u32[ptr++] : packet.c;
        packet.e.push(e);
    }
    if (hasInit) {
        const init: InitData = {
            mapSeed_: u32[ptr++],
            startSeed_: u32[ptr++],
            actors_: [],
        };
        const playersCount = u32[ptr++];
        for (let i = 0; i < playersCount; ++i) {
            const p: Actor = {
                type_: u32[ptr++],
                c: u32[ptr++],
                btn_: u32[ptr++],

                x: f32[ptr++],
                y: f32[ptr++],
                z: f32[ptr++],

                vx: f32[ptr++],
                vy: f32[ptr++],
                vz: f32[ptr++],
            };
            init.actors_.push(p);
        }
        packet.s = init;
    }
    return packet;
}

export function pack(packet: Packet): ArrayBuffer {
    const u32 = _packU32;
    const f32 = _packF32;
    let ptr = 0;
    u32[ptr++] = packet.sync_ ? 1 : 0;
    u32[ptr++] = packet.c;
    u32[ptr++] = packet.receivedOnSender_;
    u32[ptr++] = packet.t;

    packet.e.sort((a, b) => a.t - b.t);
    let event_t = packet.e.length > 0 ? packet.e[0].t : 0;
    const event_end = packet.e.length > 0 ? packet.e[packet.e.length - 1].t : -1;
    const eventsCount = event_end - event_t + 1;
    u32[ptr++] = eventsCount;
    u32[ptr++] = event_t;

    // has init
    const hasInit = !!packet.s;
    u32[ptr++] = hasInit ? 1 : 0;

    let i = 0;
    while (event_t <= event_end) {
        const e = packet.e[i];
        const t = event_t++;
        if (t < e.t) {
            u32[ptr++] = 0;
            continue;
        }
        ++i;
        let flags = 0;
        if (e.btn_ !== undefined) flags |= 1;
        if (e.spawn_) flags |= 2;
        if (!!e.c) flags |= 4;
        u32[ptr++] = flags;

        if (e.btn_ !== undefined) {
            u32[ptr++] = e.btn_;
        }
        if (e.spawn_) {
            f32[ptr++] = e.spawn_.x;
            f32[ptr++] = e.spawn_.y;
            f32[ptr++] = e.spawn_.z;
        }
        if (!!e.c) {
            u32[ptr++] = e.c;
        }
    }
    if (hasInit) {
        u32[ptr++] = packet.s.mapSeed_;
        u32[ptr++] = packet.s.startSeed_;
        u32[ptr++] = packet.s.actors_.length;
        for (let i = 0; i < packet.s.actors_.length; ++i) {
            const p = packet.s.actors_[i];

            u32[ptr++] = p.type_;
            u32[ptr++] = p.c;
            u32[ptr++] = p.btn_;
            f32[ptr++] = p.x;
            f32[ptr++] = p.y;
            f32[ptr++] = p.z;
            f32[ptr++] = p.vx;
            f32[ptr++] = p.vy;
            f32[ptr++] = p.vz;
        }
    }

    if (Const.RLE) {
        const size = encodeRLE(_packU8, ptr * 4, _rleBuffer);
        return _rleBuffer.buffer.slice(0, size);
    } else {
        return u32.buffer.slice(0, ptr * 4);
    }
}
