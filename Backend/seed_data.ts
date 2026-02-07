import { getSupabaseAdminClient } from '../packages/shared/src';
import * as dotenv from 'dotenv';
import path from 'path';

// Load ENV
dotenv.config({ path: path.join(__dirname, '../.env') });

const supabase = getSupabaseAdminClient();

async function seed(phoneNumber: string) {
    console.log(`🌱 Đang khởi tạo dữ liệu mẫu cho user: ${phoneNumber}...`);

    // 1. Tìm User ID từ phone number
    const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('phone_number', phoneNumber)
        .single();

    if (profileError || !profile) {
        console.error("❌ Không tìm thấy thông tin User trong Database. Vui lòng đăng nhập trên Web trước.");
        return;
    }

    const userId = profile.id;

    // 2. Tạo các trang trại mẫu
    const farms = [
        {
            user_id: userId,
            farm_name: "Trang trại Mekong West A1",
            farm_type: "shrimp_rice",
            area_hectares: 2.5,
            address: "Huyện Trần Đề, Sóc Trăng",
            status: "active"
        },
        {
            user_id: userId,
            farm_name: "Khu nuôi tôm công nghệ cao B2",
            farm_type: "shrimp_only",
            area_hectares: 5.2,
            address: "Hành chính huyện Mỹ Xuyên",
            status: "active"
        }
    ];

    const { data: insertedFarms, error: farmError } = await supabase
        .from('farms')
        .upsert(farms, { onConflict: 'farm_name,user_id' })
        .select();

    if (farmError) {
        console.error("❌ Lỗi tạo Farm:", farmError);
        return;
    }

    console.log(`✅ Đã tạo/cập nhật ${insertedFarms.length} trang trại.`);

    // 3. Tạo thiết bị mẫu cho từng trang trại
    for (const farm of insertedFarms) {
        const device_eui = `MEKONG_${farm.id.substring(0, 8).toUpperCase()}`;

        const { data: device, error: deviceError } = await supabase
            .from('iot_devices')
            .upsert({
                farm_id: farm.id,
                device_eui: device_eui,
                device_name: `Cảm biến ${farm.farm_name}`,
                device_type: "gateway",
                status: "active"
            }, { onConflict: 'device_eui' })
            .select()
            .single();

        if (deviceError) {
            console.error(`❌ Lỗi tạo thiết bị cho ${farm.farm_name}:`, deviceError);
            continue;
        }

        // 4. Tạo dữ liệu sensor lịch sử mẫu (24h qua)
        console.log(`📊 Đang tạo dữ liệu sensor cho ${device_eui}...`);
        const readings = [];
        const now = new Date();

        for (let i = 0; i < 24; i++) {
            const timestamp = new Date(now.getTime() - i * 60 * 60 * 1000);
            readings.push({
                device_id: device.id,
                salinity: Number((3.0 + Math.random() * 2).toFixed(2)),
                temperature: Number((27 + Math.random() * 4).toFixed(1)),
                ph: Number((7.2 + Math.random() * 0.8).toFixed(1)),
                water_level: 1.2,
                timestamp: timestamp.toISOString()
            });
        }

        await supabase.from('sensor_readings').insert(readings);
    }

    console.log("🚀 Hoàn tất! Hãy quay lại Dashboard để xem dữ liệu thật.");
}

// Chạy seed cho số điện thoại của bạn
seed('0981460071');
