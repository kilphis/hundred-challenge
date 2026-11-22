// 見た目の組み立て(川・岸・木・岩・ゴール・筏)。動きは sim.rs、画面更新は view.rs。
use crate::defs::*;
use bevy::asset::RenderAssetUsages;
use bevy::mesh::{Indices, PrimitiveTopology};
use bevy::prelude::*;
use bevy::image::{ImageAddressMode, ImageSampler, ImageSamplerDescriptor};
use bevy::render::render_resource::{Extent3d, TextureDimension, TextureFormat};
use bevy::camera::visibility::NoFrustumCulling;
use std::f32::consts::FRAC_PI_2;

const STEP: f32 = 4.0;

#[derive(Component)]
pub struct Raft;
#[derive(Component)]
pub struct Water;
/// 水面の高さに合わせて上下するもの(岩・泡)。dy は水面からの高さ
#[derive(Component)]
pub struct Floater {
    pub s: f32,
    pub d: f32,
    pub dy: f32,
}
#[derive(Component)]
pub struct Foam {
    pub seed: f32,
    pub r: f32,
}

pub const WATER_COLS: usize = 10;
pub const WATER_STEP: f32 = STEP;

/// 流れの筋の模様(横に細い筋、縦に長い)
fn streak_image() -> Image {
    let (w, h) = (64usize, 256usize);
    let mut px = vec![225u8; w * h];
    let mut a: u32 = 7;
    let mut rnd = move || {
        a = a.wrapping_mul(1664525).wrapping_add(1013904223);
        (a >> 8) as f32 / 16777216.0
    };
    for _ in 0..90 {
        let (x, y0, len) = ((rnd() * w as f32) as usize, (rnd() * h as f32) as usize, 25 + (rnd() * 70.0) as usize);
        let v = if rnd() < 0.6 { 255u8 } else { 190u8 };
        for k in 0..len {
            px[((y0 + k) % h) * w + x] = v;
            if rnd() < 0.5 {
                px[((y0 + k) % h) * w + (x + 1) % w] = v;
            }
        }
    }
    let data: Vec<u8> = px.iter().flat_map(|&v| [v, v, v, 255]).collect();
    let mut img = Image::new(Extent3d { width: w as u32, height: h as u32, depth_or_array_layers: 1 }, TextureDimension::D2, data,
        TextureFormat::Rgba8UnormSrgb, RenderAssetUsages::default());
    img.sampler = ImageSampler::Descriptor(ImageSamplerDescriptor {
        address_mode_u: ImageAddressMode::Repeat, address_mode_v: ImageAddressMode::Repeat, ..default()
    });
    img
}

fn lin(r: f32, g: f32, b: f32) -> [f32; 4] {
    Color::srgb(r, g, b).to_linear().to_f32_array()
}

/// 川に沿った帯メッシュ。f(s, u) で頂点位置と色を返す(u は 0..1 で左→外)
fn strip(cols: usize, flip: bool, f: impl Fn(f32, f32) -> (Vec3, [f32; 4])) -> Mesh {
    let rows = (END / STEP).ceil() as usize + 1;
    let (mut pos, mut col, mut idx) = (Vec::new(), Vec::new(), Vec::new());
    for i in 0..rows {
        let s = i as f32 * STEP;
        for j in 0..=cols {
            let (p, c) = f(s, j as f32 / cols as f32);
            pos.push(p.to_array());
            col.push(c);
            if i < rows - 1 && j < cols {
                let a = (i * (cols + 1) + j) as u32;
                let b = a + cols as u32 + 1;
                if flip {
                    idx.extend([a, b, a + 1, a + 1, b, b + 1]);
                } else {
                    idx.extend([a, a + 1, b, a + 1, b + 1, b]);
                }
            }
        }
    }
    let mut mesh = Mesh::new(PrimitiveTopology::TriangleList, RenderAssetUsages::default());
    mesh.insert_attribute(Mesh::ATTRIBUTE_POSITION, pos);
    mesh.insert_attribute(Mesh::ATTRIBUTE_COLOR, col);
    mesh.insert_indices(Indices::U32(idx));
    mesh.compute_smooth_normals();
    mesh
}

pub fn spawn_world(commands: &mut Commands, meshes: &mut Assets<Mesh>, mats: &mut Assets<StandardMaterial>, images: &mut Assets<Image>, rocks: &[Rock]) {
    let mat = |c: Color| StandardMaterial { base_color: c, perceptual_roughness: 1.0, reflectance: 0.0, ..default() };
    let two_sided = || StandardMaterial {
        perceptual_roughness: 1.0, reflectance: 0.0, double_sided: true, cull_mode: None, ..default()
    };

    // 水面(高さは view::water_update が毎フレーム更新する。筋の模様は流れに合わせて動かす)
    let mut water = strip(WATER_COLS, false, |s, u| {
        let hw = half_w(s) + 1.2;
        let (p, _) = frame(s, (u * 2.0 - 1.0) * hw);
        let edge = (u * 2.0 - 1.0).abs();
        let (k, w) = (edge.powi(3), 0.3 * rapidness(s));
        (p, lin(0.10 + 0.3 * k + w, 0.34 + 0.25 * k + w, 0.50 + 0.12 * k + w * 0.8))
    });
    let rows = (END / STEP).ceil() as usize + 1;
    let uv: Vec<[f32; 2]> = (0..rows)
        .flat_map(|i| (0..=WATER_COLS).map(move |j| [j as f32 / WATER_COLS as f32 * 6.0, i as f32 * STEP / 32.0]))
        .collect();
    water.insert_attribute(Mesh::ATTRIBUTE_UV_0, uv);
    let water_mat = StandardMaterial { base_color_texture: Some(images.add(streak_image())), ..two_sided() };
    commands.spawn((Mesh3d(meshes.add(water)), MeshMaterial3d(mats.add(water_mat)), Water, NoFrustumCulling));

    // 岸(左右)
    let bank_mat = mats.add(two_sided());
    for side in [-1.0f32, 1.0] {
        let m = strip(12, side < 0.0, |s, u| {
            let e = u * 60.0;
            let (p, _) = frame(s, side * (half_w(s) + 1.0 + e));
            let c = if e < 2.5 {
                lin(0.78, 0.70, 0.50)
            } else {
                let m = ((e - 2.5) / 8.0).min(1.0);
                lin(0.78 + (0.30 - 0.78) * m, 0.70 + (0.50 - 0.70) * m, 0.50 + (0.22 - 0.50) * m)
            };
            (Vec3::new(p.x, bank_h(s, e, side), p.z), c)
        });
        commands.spawn((Mesh3d(meshes.add(m)), MeshMaterial3d(bank_mat.clone())));
    }

    // 木
    let (crown_m, trunk_m) = (meshes.add(Cone::new(2.2, 6.0)), meshes.add(Cylinder::new(0.35, 2.0)));
    let (crown_c, trunk_c) = (mats.add(mat(Color::srgb(0.18, 0.42, 0.23))), mats.add(mat(Color::srgb(0.36, 0.25, 0.19))));
    let mut a: u32 = 99;
    let mut rnd = move || {
        a = a.wrapping_mul(1664525).wrapping_add(1013904223);
        (a >> 8) as f32 / 16777216.0
    };
    for _ in 0..700 {
        let (s, side, e, k) = (rnd() * END, if rnd() < 0.5 { -1.0 } else { 1.0 }, 4.0 + rnd() * 50.0, 0.7 + rnd() * 0.9);
        let (p, _) = frame(s, side * (half_w(s) + 1.0 + e));
        let y = bank_h(s, e, side);
        commands.spawn((Mesh3d(crown_m.clone()), MeshMaterial3d(crown_c.clone()),
            Transform::from_xyz(p.x, y + 4.6 * k, p.z).with_scale(Vec3::splat(k))));
        commands.spawn((Mesh3d(trunk_m.clone()), MeshMaterial3d(trunk_c.clone()),
            Transform::from_xyz(p.x, y + 0.8 * k, p.z).with_scale(Vec3::splat(k))));
    }

    // 岩と泡
    let mut ico = Sphere::new(1.0).mesh().ico(0).unwrap();
    ico.duplicate_vertices();
    ico.compute_flat_normals();
    let (rock_m, rock_c) = (meshes.add(ico), mats.add(mat(Color::srgb(0.55, 0.56, 0.58))));
    let foam_m = meshes.add(Annulus::new(1.0, 1.5));
    let foam_c = mats.add(StandardMaterial {
        base_color: Color::srgba(1.0, 1.0, 1.0, 0.55), unlit: true, alpha_mode: AlphaMode::Blend, ..default()
    });
    for r in rocks {
        let (p, _) = frame(r.s, r.d);
        commands.spawn((Mesh3d(rock_m.clone()), MeshMaterial3d(rock_c.clone()),
            Floater { s: r.s, d: r.d, dy: r.r * 0.25 },
            Transform::from_xyz(p.x, r.r * 0.25, p.z)
                .with_rotation(Quat::from_rotation_y(r.seed * 6.0))
                .with_scale(Vec3::new(r.r, r.r * (0.8 + r.seed * 0.5), r.r))));
        commands.spawn((Mesh3d(foam_m.clone()), MeshMaterial3d(foam_c.clone()), Foam { seed: r.seed, r: r.r }, Floater { s: r.s, d: r.d, dy: 0.04 },
            Transform::from_xyz(p.x, 0.04, p.z).with_rotation(Quat::from_rotation_x(-FRAC_PI_2)).with_scale(Vec3::splat(r.r))));
    }

    // ゴールの門
    let hw = half_w(LENGTH) + 1.2;
    let wood = mats.add(mat(Color::srgb(0.54, 0.35, 0.21)));
    let post = meshes.add(Cuboid::new(0.8, 7.0, 0.8));
    for side in [-1.0f32, 1.0] {
        let (p, _) = frame(LENGTH, side * hw);
        commands.spawn((Mesh3d(post.clone()), MeshMaterial3d(wood.clone()), Transform::from_xyz(p.x, 3.4, p.z)));
    }
    let (p, h) = frame(LENGTH, 0.0);
    commands.spawn((Mesh3d(meshes.add(Cuboid::new(hw * 2.0, 1.2, 0.3))), MeshMaterial3d(mats.add(mat(Color::srgb(0.85, 0.25, 0.18)))),
        Transform::from_xyz(p.x, 6.4, p.z).with_rotation(Quat::from_rotation_y(h))));

    spawn_raft(commands, meshes, mats);
}

fn spawn_raft(commands: &mut Commands, meshes: &mut Assets<Mesh>, mats: &mut Assets<StandardMaterial>) {
    let mut m = |c: Color| MeshMaterial3d(mats.add(StandardMaterial { base_color: c, perceptual_roughness: 1.0, reflectance: 0.0, ..default() }));
    let log = meshes.add(Cylinder::new(0.27, RAFT_L + 0.2));
    let (log_c, rope_c, post_c) = (m(Color::srgb(0.66, 0.47, 0.29)), m(Color::srgb(0.35, 0.27, 0.19)), m(Color::srgb(0.42, 0.29, 0.17)));
    let rope = meshes.add(Cuboid::new(RAFT_W + 0.7, 0.12, 0.3));
    let post = meshes.add(Cylinder::new(0.09, 1.3));
    let n = (RAFT_W / 0.4).round() as i32 / 2;

    commands.spawn((Raft, Transform::default(), Visibility::default())).with_children(|p| {
        for i in -n..=n {
            p.spawn((Mesh3d(log.clone()), log_c.clone(),
                Transform::from_xyz(i as f32 * 0.4, 0.05, 0.0).with_rotation(Quat::from_rotation_x(FRAC_PI_2))));
        }
        for z in [-RAFT_L * 0.33, 0.0, RAFT_L * 0.33] {
            p.spawn((Mesh3d(rope.clone()), rope_c.clone(), Transform::from_xyz(0.0, 0.34, z)));
        }
        for (x, z) in [(-1.0, -1.0), (1.0, -1.0), (-1.0, 1.0), (1.0, 1.0)] {
            p.spawn((Mesh3d(post.clone()), post_c.clone(), Transform::from_xyz(x * (RAFT_W * 0.5 - 0.1), 0.95, z * (RAFT_L * 0.5 - 0.25))));
        }
    });
}
