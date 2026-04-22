import pytest
from src.modules.order_management.domain.order import Order
from src.modules.order_management.domain.value_objects import DeliveryInfo, OrderItemLine, Money, OrderStatus

def test_order_creation_and_total_calculation():
    # 1. Arrange: Chuẩn bị thông tin giao hàng
    delivery = DeliveryInfo(
        recipient_name="Khách hàng MỘC Guitar", 
        phone_number="0987654321", 
        address="123 Đường Nhạc Cụ, TP.HCM"
    )
    order = Order(customer_id="cust-123", delivery_info=delivery)
    
    # Thêm sản phẩm vào đơn (1 cây đàn Classic và 2 bộ dây Elixir)
    order.add_item(OrderItemLine(product_id="guitar-classic-01", quantity=1, unit_price=Money(2500000)))
    order.add_item(OrderItemLine(product_id="day-dan-elixir", quantity=2, unit_price=Money(350000)))

    # 2. Act & 3. Assert: Kiểm tra trạng thái và tính toán tổng tiền
    assert order.status == OrderStatus.PENDING
    assert len(order.items) == 2
    
    # Tổng tiền = (1 * 2,500,000) + (2 * 350,000) = 3,200,000
    assert order.get_total().amount == 3200000.0

def test_order_finalize_generates_event():
    # Test xem khi chốt đơn xong có sinh ra Event để sau này bắn notification không
    delivery = DeliveryInfo(recipient_name="Nguyễn Văn B", phone_number="111222333", address="Hà Nội")
    order = Order(customer_id="cust-456", delivery_info=delivery)
    
    order.finalize_creation()
    
    # Đảm bảo có đúng 1 event được tạo ra và ID event khớp với ID đơn hàng
    assert len(order.domain_events) == 1
    assert order.domain_events[0].order_id == order.id