import { getSupabaseAdminClient, EventBus, EventType, logger } from '@mekong/shared';

export class IoTController {
    private supabase = getSupabaseAdminClient();
    private eventBus = new EventBus();

    /**
     * Nhận dữ liệu sensor (Giả lập webhook từ LoRaWAN hoặc MQTT)
     */
    async handleReading(request: any, reply: any) {
        try {
            const { device_eui, salinity, temperature, ph, water_level, battery_voltage } = request.body;

            // 1. Tìm thiết bị
            const { data: device, error: deviceError } = await this.supabase
                .from('iot_devices')
                .select('id, farm_id')
                .eq('device_eui', device_eui)
                .single();

            if (deviceError || !device) {
                return reply.status(404).send({ success: false, message: 'Device not found' });
            }

            // 2. Lưu kết quả đo
            const { error: insertError } = await this.supabase
                .from('sensor_readings')
                .insert({
                    device_id: device.id,
                    salinity,
                    temperature,
                    ph,
                    water_level,
                    battery_voltage
                });

            if (insertError) throw insertError;

            // 3. Bắn event để AI hoặc Farm service xử lý tiếp
            await this.eventBus.publish({
                type: EventType.SENSOR_DATA_RECEIVED,
                data: {
                    device_id: device.id,
                    farm_id: device.farm_id,
                    readings: { salinity, temperature, ph }
                },
                source: 'iot-service'
            });

            // 4. Kiểm tra ngưỡng để tạo cảnh báo chuyên sâu
            if (salinity > 4) {
                // Lấy user_id từ farm để gán alert
                const { data: farm } = await this.supabase
                    .from('farms')
                    .select('user_id')
                    .eq('id', device.farm_id)
                    .single();

                if (farm) {
                    await this.supabase.from('alerts').insert({
                        user_id: farm.user_id,
                        farm_id: device.farm_id,
                        alert_type: 'salinity_high',
                        severity: 'critical',
                        title: '🔴 CẢNH BÁO MẶN XÂM NHẬP',
                        message: `Phát hiện độ mặn ${salinity}‰ tại khu vực của bạn. Vượt ngưỡng an toàn!`,
                        status: 'active'
                    });
                }

                await this.eventBus.publish({
                    type: EventType.ALERT_TRIGGERED,
                    data: {
                        farm_id: device.farm_id,
                        severity: 'critical',
                        title: 'High Salinity Alert',
                        message: `Salinity level detected at ${salinity}‰`
                    },
                    source: 'iot-service'
                });
            }

            return { success: true };
        } catch (error: any) {
            logger.error(`IoT Handle Error: ${error.message}`);
            return reply.status(500).send({ success: false, message: error.message });
        }
    }

    /**
     * Lấy dữ liệu sensor mới nhất cho Dashboard
     */
    async getLatestReadings(request: any, reply: any) {
        try {
            const { data, error } = await this.supabase
                .from('sensor_readings')
                .select('*, iot_devices(device_name, farm_id)')
                .order('timestamp', { ascending: false })
                .limit(20);

            if (error) throw error;
            return { success: true, data };
        } catch (error: any) {
            return reply.status(500).send({ success: false, message: error.message });
        }
    }
}
