const prisma = require('../Db/prisma');

exports.getPublicStats = async (req, res) => {
  try {
    const now = new Date();

    const [
      activeListings,
      registeredVendors,
      verifiedVendors,
      registeredBuyers,
      renewalTotals,
    ] = await Promise.all([
      prisma.product.count({
        where: {
          isActive: true,
          expiresAt: { gt: now },
        },
      }),
      prisma.vendor.count({
        where: {
          user: {
            is: { isActive: true },
          },
        },
      }),
      prisma.vendor.count({
        where: {
          isApproved: true,
          verificationStatus: 'verified',
          user: {
            is: { isActive: true },
          },
        },
      }),
      prisma.user.count({
        where: {
          role: 'customer',
          isActive: true,
        },
      }),
      prisma.product.aggregate({
        _sum: {
          renewalCount: true,
        },
      }),
    ]);

    res.json({
      success: true,
      stats: {
        activeListings,
        registeredVendors,
        verifiedVendors,
        registeredBuyers,
        totalRenewals: renewalTotals._sum.renewalCount || 0,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
