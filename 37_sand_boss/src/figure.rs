// 棒人間の組み立て。プレイヤーもボスも同じ形(ボスは scale で大きくする)。
use crate::defs::*;
use bevy::prelude::*;

/// 走りのときに前後に振る手足。side は +1/-1(左右で逆位相)
#[derive(Component)]
pub struct Limb {
    pub side: f32,
}

/// ボスの腕(技の構えで上げ下げする)。side は Limb と同じ向きの符号
#[derive(Component)]
pub struct Arm {
    pub side: f32,
}

pub fn spawn_figure(
    commands: &mut Commands,
    meshes: &mut Assets<Mesh>,
    mat: Handle<StandardMaterial>,
    transform: Transform,
    animated: bool,
) -> Entity {
    let head = meshes.add(Sphere::new(0.15));
    let torso = meshes.add(Cylinder::new(0.045, 0.62));
    let leg = meshes.add(Cylinder::new(0.04, 0.85));
    let arm = meshes.add(Cylinder::new(0.035, 0.6));
    let root = commands.spawn((transform, Visibility::default())).id();
    commands.entity(root).with_children(|p| {
        p.spawn((
            Mesh3d(head),
            MeshMaterial3d(mat.clone()),
            Transform::from_xyz(0.0, PLAYER_HEIGHT - 0.15, 0.0),
        ));
        p.spawn((
            Mesh3d(torso),
            MeshMaterial3d(mat.clone()),
            Transform::from_xyz(0.0, 1.14, 0.0),
        ));
        // (長さ, 付け根の高さ, 左右のずれ, メッシュ)。脚は逆位相、腕は脚と逆に振る
        for (len, y, x, mesh, side, is_arm) in [
            (0.85, 0.85, 0.1, &leg, 1.0, false),
            (0.85, 0.85, -0.1, &leg, -1.0, false),
            (0.6, 1.42, 0.2, &arm, -1.0, true),
            (0.6, 1.42, -0.2, &arm, 1.0, true),
        ] {
            let mut pivot = p.spawn((Transform::from_xyz(x, y, 0.0), Visibility::default()));
            if animated {
                pivot.insert(Limb { side });
            } else if is_arm {
                pivot.insert(Arm { side });
            }
            pivot.with_children(|q| {
                q.spawn((
                    Mesh3d(mesh.clone()),
                    MeshMaterial3d(mat.clone()),
                    Transform::from_xyz(0.0, -len / 2.0, 0.0),
                ));
            });
        }
    });
    root
}

/// 魔法使いの三角帽(プレイヤー用)
pub fn add_wizard_hat(commands: &mut Commands, meshes: &mut Assets<Mesh>, mats: &mut Assets<StandardMaterial>, root: Entity) {
    let mat = mats.add(StandardMaterial { base_color: HAT_COLOR, perceptual_roughness: 1.0, ..default() });
    let brim = meshes.add(Cylinder::new(0.3, 0.02));
    let cone = meshes.add(Cone { radius: 0.2, height: 0.55 });
    commands.entity(root).with_children(|p| {
        p.spawn((Mesh3d(brim), MeshMaterial3d(mat.clone()), Transform::from_xyz(0.0, PLAYER_HEIGHT - 0.1, 0.0)));
        p.spawn((Mesh3d(cone), MeshMaterial3d(mat), Transform::from_xyz(0.0, PLAYER_HEIGHT - 0.1 + 0.275, 0.0)));
    });
}
