from supabase import Client
from ...domain.repositories import OrderRepository, ProductRepository
from ...domain.order import Order

class SupabaseOrderRepository(OrderRepository):
    def __init__(self, supabase_client: Client):
        self.supabase = supabase_client

    def save(self, order: Order) -> None:
        # Tách dữ liệu Order Aggregate thành dạng bảng Relational
        order_data = {
            "id": order.id,
            "customer_id": order.customer_id,
            "status": order.status.value,
            "recipient_name": order.delivery_info.recipient_name,
            "phone_number": order.delivery_info.phone_number,
            "address": order.delivery_info.address,
            "total_amount": order.get_total().amount,
            "created_at": order.created_at.isoformat()
        }
        
        # Thực thi Transaction trên Supabase (insert order và order_items)
        self.supabase.table("orders").insert(order_data).execute()

        items_data = [
            {
                "order_id": order.id,
                "product_id": item.product_id,
                "quantity": item.quantity,
                "unit_price": item.unit_price.amount
            }
            for item in order.items
        ]
        if items_data:
            self.supabase.table("order_items").insert(items_data).execute()

    def get_by_id(self, order_id: str) -> Order:
        # Logic query Supabase và map ngược lại thành Order Aggregate
        pass

# Thêm Adapter cho ProductRepo (có thể tách file riêng trong thực tế)
class SupabaseProductRepository(ProductRepository):
    def __init__(self, supabase_client: Client):
        self.supabase = supabase_client

    def get_price(self, product_id: str) -> float:
        response = self.supabase.table("products").select("price").eq("id", product_id).single().execute()
        return response.data.get("price", 0.0)

    def check_stock(self, product_id: str, required_quantity: int) -> bool:
        response = self.supabase.table("products").select("stock").eq("id", product_id).single().execute()
        return response.data.get("stock", 0) >= required_quantity