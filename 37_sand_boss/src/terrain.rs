// 地面: 円形(極座標グリッド)の高さマップ。削った深さ dig を持ち、メッシュを更新する。
use crate::defs::*;
use bevy::asset::RenderAssetUsages;
use bevy::color::{LinearRgba, Mix};
use bevy::mesh::{Indices, PrimitiveTopology};
use bevy::prelude::*;
use bevy::camera::visibility::NoFrustumCulling;
use std::f32::consts::TAU;

const NR: usize = TERRAIN_RINGS;
const NT: usize = TERRAIN_SECTORS;
const DR: f32 = ARENA_RADIUS / NR as f32;
const DT: f32 = TAU / NT as f32;

#[derive(Resource)]
pub struct Terrain {
    dig: Vec<f32>, // 頂点ごとの削れた深さ(0 以上)
    xz: Vec<Vec2>, // 頂点の水平位置
    mesh: Handle<Mesh>,
    dirty: bool,
    any: bool, // どこかが削れているか
}

fn idx(i: usize, j: usize) -> usize {
    i * NT + (j % NT)
}

impl Terrain {
    /// 水平位置の地面の高さ(削れていれば負)
    pub fn height_at(&self, p: Vec2) -> f32 {
        let r = p.length();
        if r >= ARENA_RADIUS {
            return 0.0;
        }
        let fi = r / DR;
        let i0 = (fi as usize).min(NR - 1);
        let tr = fi - i0 as f32;
        let fj = p.y.atan2(p.x).rem_euclid(TAU) / DT;
        let j0 = fj as usize;
        let tj = fj - j0 as f32;
        let h = |i, j| -self.dig[idx(i, j)];
        let a = h(i0, j0) * (1.0 - tj) + h(i0, j0 + 1) * tj;
        let b = h(i0 + 1, j0) * (1.0 - tj) + h(i0 + 1, j0 + 1) * tj;
        a * (1.0 - tr) + b * tr
    }

    /// center 中心・radius の範囲を、お椀状に depth まで削る(すでに深い所はそのまま)
    pub fn carve(&mut self, center: Vec2, radius: f32, depth: f32) {
        for (d, xz) in self.dig.iter_mut().zip(&self.xz) {
            let dist = xz.distance(center);
            if dist < radius {
                let t = 1.0 - dist / radius;
                let target = depth * t * t * (3.0 - 2.0 * t);
                if target > *d {
                    *d = target;
                    self.dirty = true;
                    self.any = true;
                }
            }
        }
    }

    /// 砂が穴を埋め戻す
    pub fn refill(&mut self, dt: f32) {
        if !self.any {
            return;
        }
        let mut any = false;
        for d in self.dig.iter_mut().filter(|d| **d > 0.0) {
            *d = (*d - REFILL_RATE * dt).max(0.0);
            any |= *d > 0.0;
        }
        self.any = any;
        self.dirty = true;
    }

    fn pos(&self, i: usize, j: usize) -> Vec3 {
        let p = self.xz[idx(i, j)];
        Vec3::new(p.x, -self.dig[idx(i, j)], p.y)
    }

    fn fill_mesh(&self, mesh: &mut Mesh) {
        let (sand, ring, soil) = (SAND.to_linear(), SAND_RING.to_linear(), SOIL_DARK.to_linear());
        let n = (NR + 1) * NT;
        let (mut pos, mut nor, mut col) = (Vec::with_capacity(n), Vec::with_capacity(n), Vec::with_capacity(n));
        for i in 0..=NR {
            for j in 0..NT {
                let p = self.pos(i, j);
                let pr = self.pos((i + 1).min(NR), j) - self.pos(i.saturating_sub(1), j);
                let pt = self.pos(i, j + 1) - self.pos(i, j + NT - 1);
                let normal = if i == 0 { Vec3::Y } else { pt.cross(pr).normalize_or(Vec3::Y) };
                let mut c: LinearRgba = sand.mix(&soil, (self.dig[idx(i, j)] / DIG_DEPTH_MAX).min(1.0));
                if i > 0 && i % RING_EVERY == 0 {
                    c = c.mix(&ring, 0.8);
                }
                pos.push(p.to_array());
                nor.push(normal.to_array());
                col.push([c.red, c.green, c.blue, 1.0]);
            }
        }
        mesh.insert_attribute(Mesh::ATTRIBUTE_POSITION, pos);
        mesh.insert_attribute(Mesh::ATTRIBUTE_NORMAL, nor);
        mesh.insert_attribute(Mesh::ATTRIBUTE_COLOR, col);
    }
}

pub fn spawn_terrain(commands: &mut Commands, meshes: &mut Assets<Mesh>, mats: &mut Assets<StandardMaterial>) {
    let mut xz = Vec::with_capacity((NR + 1) * NT);
    for i in 0..=NR {
        for j in 0..NT {
            let (r, a) = (i as f32 * DR, j as f32 * DT);
            xz.push(Vec2::new(r * a.cos(), r * a.sin()));
        }
    }
    let mut indices = Vec::with_capacity(NR * NT * 6);
    for i in 0..NR {
        for j in 0..NT {
            let (a, b, c, d) = (idx(i, j), idx(i, j + 1), idx(i + 1, j), idx(i + 1, j + 1));
            indices.extend([a, b, c, b, d, c].map(|v| v as u32));
        }
    }
    let mut mesh = Mesh::new(PrimitiveTopology::TriangleList, RenderAssetUsages::default());
    mesh.insert_indices(Indices::U32(indices));
    let handle = meshes.add(mesh);
    let terrain = Terrain { dig: vec![0.0; (NR + 1) * NT], xz, mesh: handle.clone(), dirty: false, any: false };
    terrain.fill_mesh(meshes.get_mut(&handle).unwrap());
    commands.spawn((
        Mesh3d(handle),
        MeshMaterial3d(mats.add(StandardMaterial { base_color: Color::WHITE, perceptual_roughness: 1.0, ..default() })),
        NoFrustumCulling,
    ));
    commands.insert_resource(terrain);
}

pub fn update_terrain(mut terrain: ResMut<Terrain>, mut meshes: ResMut<Assets<Mesh>>) {
    if !terrain.dirty {
        return;
    }
    terrain.dirty = false;
    if let Some(mesh) = meshes.get_mut(&terrain.mesh) {
        terrain.fill_mesh(mesh);
    }
}
