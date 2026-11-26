# 津波: 海岸の高さ H(t)・浸水の広がり・浸水深

# 海岸での高さ (m)。到達前は 0、到達から T_RISE で H_MAX まで直線で上がる
coast_height(t) = t < T_ARRIVE ? 0.0 : H_MAX * min((t - T_ARRIVE) / T_RISE, 1.0)

# マス (y) の水位 L = H(t) - DECAY*(y - SEA_Y)
water_level(h, y) = h - DECAY * (y - SEA_Y)

# 海のマスだけ浸水済みにした行列
function init_flooded()
    flooded = falses(W, H)
    flooded[:, 1:SEA_Y] .= true
    return flooded
end

# 1ステップ分、浸水を広げて浸水深を更新する
function advance_tsunami!(flooded, depth, elev, t)
    h = coast_height(t)
    h > 0 || return
    sources = findall(flooded)                    # 1層目は浸水済みの全マスから
    for _ in 1:FRONT_SPEED
        fresh = CartesianIndex{2}[]
        for c in sources
            x, y = c[1], c[2]
            for (dx, dy) in NEIGHBORS8
                nx, ny = x + dx, y + dy
                (1 <= nx <= W && 1 <= ny <= H) || continue
                flooded[nx, ny] && continue
                if elev[nx, ny] < water_level(h, ny)
                    flooded[nx, ny] = true
                    push!(fresh, CartesianIndex(nx, ny))
                end
            end
        end
        sources = fresh                           # 2層目は新しく浸かったマスから
    end
    for y in SEA_Y+1:H, x in 1:W
        if flooded[x, y]
            depth[x, y] = max(water_level(h, y) - elev[x, y], 0.0)
        end
    end
    return
end
