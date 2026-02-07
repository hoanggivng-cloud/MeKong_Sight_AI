import { Request, Response } from 'express';
import { getSupabaseAdminClient } from '@mekong/shared';
import { logger } from '@mekong/shared';

export class FarmController {
    private supabase = getSupabaseAdminClient();

    /**
     * Lấy danh sách trang trại của người dùng
     */
    async getMyFarms(req: Request, res: Response) {
        try {
            const userId = (req as any).user.sub;
            const { data, error } = await this.supabase
                .from('farms')
                .select('*')
                .eq('user_id', userId);

            if (error) throw error;
            return res.json({ success: true, data });
        } catch (error: any) {
            logger.error(`Get farms error: ${error.message}`);
            return res.status(500).json({ success: false, message: error.message });
        }
    }

    /**
     * Tạo trang trại mới
     */
    async createFarm(req: Request, res: Response) {
        try {
            const userId = (req as any).user.sub;
            const { farm_name, farm_type, area_hectares, farm_code, address } = req.body;

            const { data, error } = await this.supabase
                .from('farms')
                .insert({
                    user_id: userId,
                    farm_name,
                    farm_type,
                    area_hectares,
                    farm_code,
                    address,
                    status: 'active'
                })
                .select()
                .single();

            if (error) throw error;
            return res.status(201).json({ success: true, data });
        } catch (error: any) {
            logger.error(`Create farm error: ${error.message}`);
            return res.status(500).json({ success: false, message: error.message });
        }
    }

    /**
     * Lấy chi tiết trang trại
     */
    async getFarmDetails(req: Request, res: Response) {
        try {
            const { id } = req.params;
            const { data, error } = await this.supabase
                .from('farms')
                .select('*, iot_devices(*)')
                .eq('id', id)
                .single();

            if (error) throw error;
            return res.json({ success: true, data });
        } catch (error: any) {
            return res.status(404).json({ success: false, message: 'Farm not found' });
        }
    }

    /**
     * Lấy danh sách cảnh báo của người dùng
     */
    async getAlerts(req: Request, res: Response) {
        try {
            const userId = (req as any).user.sub;
            const { data, error } = await this.supabase
                .from('alerts')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false });

            if (error) throw error;
            return res.json({ success: true, data });
        } catch (error: any) {
            return res.status(500).json({ success: false, message: error.message });
        }
    }

    /**
     * Xác nhận cảnh báo
     */
    async acknowledgeAlert(req: Request, res: Response) {
        try {
            const { id } = req.params;
            const { error } = await this.supabase
                .from('alerts')
                .update({
                    status: 'acknowledged',
                    acknowledged_at: new Date().toISOString()
                })
                .eq('id', id);

            if (error) throw error;
            return res.json({ success: true });
        } catch (error: any) {
            return res.status(500).json({ success: false, message: error.message });
        }
    }

    /**
     * Xóa trang trại
     */
    async deleteFarm(req: Request, res: Response) {
        try {
            const { id } = req.params;
            const { error } = await this.supabase
                .from('farms')
                .delete()
                .eq('id', id);

            if (error) throw error;
            return res.json({ success: true });
        } catch (error: any) {
            return res.status(500).json({ success: false, message: error.message });
        }
    }
}
