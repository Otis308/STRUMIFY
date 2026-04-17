from supabase import Client
from ...domain.entities.order import Order
from ...domain.repositories.i_order_repository import IOrderRepository

class SupabaseOrderRepository(IOrderRepository):
    def __init__(self, supabase_client: Client):
        self.supabase = supabase_client

    def save(self, order: Order) -> Order:
        # 1. Format dữ liệu để Supabase hiểu
        order_data = {
            "id": order.id,
            "customer_id": order.customer_id,
            "status": order.status,
            "total_price": order.get_total_price()
        }
        
        try:
            # 2. Gọi API Supabase để Insert vào bảng 'orders'
            response = self.supabase.table("orders").insert(order_data).execute()
            self.supabase.table("order_items").insert([...]).execute()
            return order
        except Exception as e:
            raise Exception(f"Lỗi khi lưu DB: {str(e)}")