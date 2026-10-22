
const prisma = require('../Db/prisma');

const normalizeCode = (code) =>
  typeof code === 'string' ? code.trim().toUpperCase() : '';

const getCouponStatus = (coupon, now = new Date()) => {
  if (!coupon.isActive) return 'inactive';
  if (coupon.startsAt > now) return 'not_started';
  if (coupon.expiresAt <= now) return 'expired';

  if (
    coupon.usageLimit !== null &&
    coupon.redemptions.length >= coupon.usageLimit
  ) {
    return 'limit_reached';
  }

  return 'valid';
};

const publicCoupon = (coupon) => ({
  id: coupon.id,
  code: coupon.code,
  discountType: coupon.discountType,
  discountValue: coupon.discountValue,
  maxDiscount: coupon.maxDiscount,
  minPurchase: coupon.minPurchase,
  startsAt: coupon.startsAt,
  expiresAt: coupon.expiresAt,
  usageLimit: coupon.usageLimit,
  isActive: coupon.isActive,
  createdAt: coupon.createdAt,
  redemptionCount: coupon._count?.redemptions ?? coupon.redemptions?.length ?? 0,
});

exports.createCoupon = async (req, res) => {
  try {
    const code = normalizeCode(req.body.code);
    const discountType = req.body.discountType;
    const discountValue = Number(req.body.discountValue);
    const minPurchase = Number(req.body.minPurchase ?? 0);
    const maxDiscount =
      req.body.maxDiscount === undefined ||
      req.body.maxDiscount === null ||
      req.body.maxDiscount === ''
        ? null
        : Number(req.body.maxDiscount);
    const usageLimit =
      req.body.usageLimit === undefined ||
      req.body.usageLimit === null ||
      req.body.usageLimit === ''
        ? null
        : Number(req.body.usageLimit);

    const startsAt =
      req.body.startsAt === undefined || req.body.startsAt === ''
        ? new Date()
        : new Date(req.body.startsAt);
    const expiresAt = new Date(req.body.expiresAt);

    if (!/^[A-Z0-9_-]{3,40}$/.test(code)) {
      return res.status(400).json({
        success: false,
        message: 'Code must be 3–40 characters using letters, numbers, _ or -.',
      });
    }

    if (!['percentage', 'fixed'].includes(discountType)) {
      return res.status(400).json({
        success: false,
        message: 'discountType must be percentage or fixed.',
      });
    }

    if (
      !Number.isFinite(discountValue) ||
      discountValue <= 0 ||
      (discountType === 'percentage' && discountValue > 100)
    ) {
      return res.status(400).json({
        success: false,
        message: 'Invalid discountValue.',
      });
    }

    if (!Number.isFinite(minPurchase) || minPurchase < 0) {
      return res.status(400).json({
        success: false,
        message: 'minPurchase must be zero or greater.',
      });
    }

    if (
      maxDiscount !== null &&
      (!Number.isFinite(maxDiscount) || maxDiscount <= 0)
    ) {
      return res.status(400).json({
        success: false,
        message: 'maxDiscount must be greater than zero when provided.',
      });
    }

    if (
      usageLimit !== null &&
      (!Number.isInteger(usageLimit) || usageLimit < 1)
    ) {
      return res.status(400).json({
        success: false,
        message: 'usageLimit must be a positive integer.',
      });
    }

    if (
      Number.isNaN(startsAt.getTime()) ||
      Number.isNaN(expiresAt.getTime()) ||
      expiresAt <= startsAt
    ) {
      return res.status(400).json({
        success: false,
        message: 'Provide valid dates; expiresAt must be after startsAt.',
      });
    }

    const coupon = await prisma.coupon.create({
      data: {
        code,
        discountType,
        discountValue,
        minPurchase,
        maxDiscount,
        usageLimit,
        startsAt,
        expiresAt,
        createdById: req.user.id,
      },
      include: {
        _count: { select: { redemptions: true } },
      },
    });

    return res.status(201).json({
      success: true,
      message: 'Coupon created successfully.',
      coupon: publicCoupon(coupon),
    });
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(409).json({
        success: false,
        message: 'A coupon with this code already exists.',
      });
    }

    console.error('Create coupon error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create coupon.',
    });
  }
};

exports.listCoupons = async (req, res) => {
  try {
    const coupons = await prisma.coupon.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { redemptions: true } },
      },
    });

    return res.json({
      success: true,
      coupons: coupons.map(publicCoupon),
    });
  } catch (error) {
    console.error('List coupons error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch coupons.',
    });
  }
};

exports.deactivateCoupon = async (req, res) => {
  try {
    const coupon = await prisma.coupon.update({
      where: { id: req.params.id },
      data: { isActive: false },
      include: {
        _count: { select: { redemptions: true } },
      },
    });

    return res.json({
      success: true,
      message: 'Coupon deactivated.',
      coupon: publicCoupon(coupon),
    });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({
        success: false,
        message: 'Coupon not found.',
      });
    }

    console.error('Deactivate coupon error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to deactivate coupon.',
    });
  }
};

exports.validateCoupon = async (req, res) => {
  try {
    const code = normalizeCode(req.body.code);
    const purchaseAmount = Number(req.body.purchaseAmount);

    if (!code || !Number.isFinite(purchaseAmount) || purchaseAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Provide a coupon code and a valid purchaseAmount.',
      });
    }

    const coupon = await prisma.coupon.findUnique({
      where: { code },
      include: {
        redemptions: {
          where: { userId: req.user.id },
          select: { id: true },
        },
        _count: { select: { redemptions: true } },
      },
    });

    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: 'Coupon not found.',
      });
    }

    const status = getCouponStatus(coupon);

    if (status !== 'valid') {
      const messages = {
        inactive: 'This coupon is inactive.',
        not_started: 'This coupon is not active yet.',
        expired: 'This coupon has expired.',
        limit_reached: 'This coupon has reached its usage limit.',
      };

      return res.status(400).json({
        success: false,
        message: messages[status],
      });
    }

    if (coupon.redemptions.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'You have already redeemed this coupon.',
      });
    }

    if (purchaseAmount < coupon.minPurchase) {
      return res.status(400).json({
        success: false,
        message: `Minimum purchase amount is ${coupon.minPurchase}.`,
      });
    }

    let discount =
      coupon.discountType === 'percentage'
        ? (purchaseAmount * coupon.discountValue) / 100
        : coupon.discountValue;

    if (coupon.maxDiscount !== null) {
      discount = Math.min(discount, coupon.maxDiscount);
    }

    discount = Math.min(discount, purchaseAmount);
    discount = Math.round((discount + Number.EPSILON) * 100) / 100;

    return res.json({
      success: true,
      message: 'Coupon is valid. This is a preview; it has not been redeemed.',
      coupon: {
        code: coupon.code,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
      },
      purchaseAmount,
      discount,
      finalAmount: Math.round((purchaseAmount - discount) * 100) / 100,
      redeemed: false,
    });
  } catch (error) {
    console.error('Validate coupon error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to validate coupon.',
    });
  }
};

exports.listAvailableCoupons = async (req, res) => {
  try {
    const now = new Date();

    const coupons = await prisma.coupon.findMany({
      where: {
        isActive: true,
        startsAt: { lte: now },
        expiresAt: { gt: now },
      },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { redemptions: true } },
      },
    });

    const availableCoupons = coupons
      .filter((coupon) => {
        const status = getCouponStatus({
          ...coupon,
          redemptions: Array.from({
            length: coupon._count.redemptions,
          }),
        }, now);

        return status === 'valid';
      })
      .map((coupon) => ({
        id: coupon.id,
        code: coupon.code,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
        maxDiscount: coupon.maxDiscount,
        minPurchase: coupon.minPurchase,
        expiresAt: coupon.expiresAt,
      }));

    return res.json({
      success: true,
      coupons: availableCoupons,
    });
  } catch (error) {
    console.error('List available coupons error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch available coupons.',
    });
  }
};

