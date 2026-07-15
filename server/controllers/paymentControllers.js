const { InvoiceStatus } = require('@prisma/client')
const { findInvoiceById } = require('../services/invoiceServices')
const { findUnpaidInvoiceItemsByIds } = require('../services/invoiceItemServices')
const { createPayment } = require('../services/paymentServices')
const { InvoiceStatus } = require('@prisma/client')

exports.createPaymentController = async (req, res, next) => {
  // itemPayments: invoice item id->amount map = [["1", 100], ["2", 80],...]
  const { invoiceId, method, note } = req.body
  let { itemPayments } = req.body
  try {
    const invoiceRecord = await findInvoiceById(invoiceId)
    if (!invoiceRecord || ![InvoiceStatus.ISSUED, InvoiceStatus.PARTIALLY_PAID, InvoiceStatus.OVERDUE].includes(invoiceRecord.status)) {
      return res.status(404).json({
        message: 'No eligible invoices for payment'
      })
    }

    itemPayments = new Map(itemPayments)

    const invoiceItems = await findUnpaidInvoiceItemsByIds([...itemPayments.keys()])

    if (invoiceItems.length === 0) {
      return res.status(401).json({
        message: 'No pending payment for any invoices'
      })
    }

    if (invoiceItems.length !== itemPayments.size) {
      return res.status(401).json({
        message: 'One or more invoice items not eligible for payment'
      })
    }

    for (const item of invoiceItems) {
      if (itemPayments.get(item.id) > item.amount - item.paidAmount) {
        return res.status(401).json({
          message: 'Payment amount exceeds one or more items required amount'
        })
      }
    }

    const paymentRecord = await createPayment({
      invoiceId: invoiceRecord.id,
      method,
      recordedById: req.user.id,
      note: note ?? null
    }, itemPayments)


    return res.status(200).json({
      data: paymentRecord
    })

  } catch (error) {
    next(error)
  }
}

// controller
exports.getInvoicePaymentLedgerController = async (req, res, next) => {
  const { invoiceId } = req.params;
  try {
    const ledger = await getInvoicePaymentLedger(invoiceId);

    if (!ledger) {
      return res.status(404).json({ message: 'Invoice not found' });
    }

    return res.status(200).json({ data: ledger });
  } catch (error) {
    next(error);
  }
};

exports.voidPaymentController = async (req, res, next) => {
  const { paymentId } = req.params;
  const { reason } = req.body;
  try {
    const result = await voidPayment(paymentId, req.user.id, reason);
    return res.status(200).json({ data: result });
  } catch (error) {
    if (error.message === 'Payment not found') {
      return res.status(404).json({ message: error.message });
    }
    if (error.message === 'Payment already voided') {
      return res.status(400).json({ message: error.message });
    }
    next(error);
  }
};