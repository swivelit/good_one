
const prisma = require('../Db/prisma');


exports.createOrder = async (req, res) => {
  try {
    const customerId = req.user.id;
    const { items, paymentMethod, couponCode, shippingAddress } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Your cart is empty.',
      });
    }

    if (!['online', 'offline'].includes(paymentMethod)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid payment method.',
      });
    }

    const quantities = new Map();

    for (const item of items) {
      const productId = String(item.productId || '');
      const quantity = Number(item.quantity);

      if (
        !productId ||
        !Number.isInteger(quantity) ||
        quantity < 1 ||
        quantity > 99
      ) {
        return res.status(400).json({
          success: false,
          message: 'Invalid product or quantity.',
        });
      }

      quantities.set(
        productId,
        (quantities.get(productId) || 0) + quantity,
      );
    }

    const productIds = [...quantities.keys()];
    const products = await prisma.product.findMany({
      where: {
        id: { in: productIds },
        isActive: true,
        expiresAt: { gt: new Date() },
      },
    });

    if (products.length !== productIds.length) {
      return res.status(400).json({
        success: false,
        message: 'One or more products are unavailable.',
      });
    }

    const subtotal = Math.round(
      products.reduce(
        (sum, product) =>
          sum + product.price * quantities.get(product.id),
        0,
      ) * 100,
    ) / 100;

    if (!Number.isFinite(subtotal) || subtotal <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid order total.',
      });
    }

    const normalizedCode =
      typeof couponCode === 'string' ? couponCode.trim().toUpperCase() : '';

    const result = await prisma.$transaction(async (tx) => {
      let discount = 0;
      let appliedCoupon = null;

      if (normalizedCode) {
        const now = new Date();

        const coupon = await tx.coupon.findUnique({
          where: { code: normalizedCode },
          include: {
            redemptions: {
              select: { userId: true },
            },
            _count: { select: { redemptions: true } },
          },
        });

        if (!coupon) {
          throw Object.assign(new Error('Coupon not found.'), {
            statusCode: 400,
          });
        }

        if (
          !coupon.isActive ||
          coupon.startsAt > now ||
          coupon.expiresAt <= now
        ) {
          throw Object.assign(
            new Error('This coupon is inactive or expired.'),
            { statusCode: 400 },
          );
        }

        if (
          coupon.usageLimit !== null &&
          coupon._count.redemptions >= coupon.usageLimit
        ) {
          throw Object.assign(
            new Error('This coupon has reached its usage limit.'),
            { statusCode: 400 },
          );
        }

        if (coupon.redemptions.some((r) => r.userId === customerId)) {
          throw Object.assign(
            new Error('You have already redeemed this coupon.'),
            { statusCode: 409 },
          );
        }

        if (subtotal < coupon.minPurchase) {
          throw Object.assign(
            new Error(
              `Minimum purchase amount is ₹${coupon.minPurchase}.`,
            ),
            { statusCode: 400 },
          );
        }

        discount =
          coupon.discountType === 'percentage'
            ? (subtotal * coupon.discountValue) / 100
            : coupon.discountValue;

        if (coupon.maxDiscount !== null) {
          discount = Math.min(discount, coupon.maxDiscount);
        }

        discount = Math.round(
          Math.min(discount, subtotal) * 100,
        ) / 100;

        appliedCoupon = coupon.code;

        // The unique (couponId, userId) constraint prevents reuse.
        await tx.couponRedemption.create({
          data: {
            couponId: coupon.id,
            userId: customerId,
          },
        });
      }

      const total = Math.round((subtotal - discount) * 100) / 100;

      const order = await tx.order.create({
        data: {
          customerId,
          subtotal,
          discount,
          total,
          couponCode: appliedCoupon,
          paymentMethod,
          paymentStatus: 'pending',
          status: 'pending',
          shippingAddress: shippingAddress
            ? String(shippingAddress).trim().slice(0, 1000)
            : null,
          items: {
            create: products.map((product) => {
              const quantity = quantities.get(product.id);

              return {
                productId: product.id,
                productTitle: product.title,
                unitPrice: product.price,
                quantity,
                lineTotal: Math.round(
                  product.price * quantity * 100,
                ) / 100,
              };
            }),
          },
        },
        include: { items: true },
      });

      return order;
    });

    return res.status(201).json({
      success: true,
      message: 'Order created. Payment is still pending.',
      order: result,
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message,
      });
    }

    // Handle simultaneous attempts to redeem the same coupon.
    if (error.code === 'P2002') {
      return res.status(409).json({
        success: false,
        message: 'You have already redeemed this coupon.',
      });
    }

    console.error('Create order error:', error);
    return res.status(500).json({
      success: false,
      message: 'Unable to create order.',
    });
  }
};


exports.listMyOrders = async (req, res) => {
  try {
    const orders = await prisma.order.findMany({
      where: { customerId: req.user.id },
      include: { items: true },
      orderBy: { createdAt: 'desc' },
    });

    return res.json({ success: true, orders });
  } catch (error) {
    console.error('List orders error:', error);
    return res.status(500).json({
      success: false,
      message: 'Unable to load orders.',
    });
  }
};

exports.cancelMyOrder = async (req, res) => {
  try {
    const orderId = String(req.params.id || '').trim();

    if (!orderId) {
      return res.status(400).json({
        success: false,
        message: 'Order ID is required.',
      });
    }

    // Restrict the lookup to the authenticated customer's own order.
    const order = await prisma.order.findFirst({
      where: {
        id: orderId,
        customerId: req.user.id,
      },
      select: {
        id: true,
        status: true,
      },
    });

    if (!order) {
      // Same response for missing orders and another customer's orders.
      return res.status(404).json({
        success: false,
        message: 'Order not found.',
      });
    }

    if (order.status !== 'pending') {
      return res.status(409).json({
        success: false,
        message: 'Only pending orders can be cancelled.',
      });
    }

    // Atomic conditional update prevents cancellation if the order
    // changes status between the lookup and the update.
    const result = await prisma.order.updateMany({
      where: {
        id: order.id,
        customerId: req.user.id,
        status: 'pending',
      },
      data: {
        status: 'cancelled',
      },
    });

    if (result.count !== 1) {
      return res.status(409).json({
        success: false,
        message: 'The order status changed. Refresh your orders and try again.',
      });
    }

    const cancelledOrder = await prisma.order.findUnique({
      where: { id: order.id },
      include: { items: true },
    });

    return res.json({
      success: true,
      message: 'Order cancelled successfully.',
      order: cancelledOrder,
    });
  } catch (error) {
    console.error('Cancel order error:', error);
    return res.status(500).json({
      success: false,
      message: 'Unable to cancel order.',
    });
  }
};

