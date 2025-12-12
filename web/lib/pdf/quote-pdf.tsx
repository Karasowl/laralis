import React from 'react'
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
} from '@react-pdf/renderer'
import type { Quote, QuoteItem, Patient } from '@/lib/types'

// Styles for the quote PDF
const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: 'Helvetica',
  },
  header: {
    marginBottom: 25,
    borderBottom: '2 solid #2563eb',
    paddingBottom: 15,
  },
  clinicName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1e3a5f',
    marginBottom: 5,
  },
  clinicInfo: {
    fontSize: 9,
    color: '#666',
  },
  quoteTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'right',
    color: '#2563eb',
    marginTop: 10,
  },
  quoteNumber: {
    fontSize: 10,
    textAlign: 'right',
    color: '#666',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  infoBox: {
    width: '48%',
  },
  infoBoxTitle: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#666',
    marginBottom: 5,
    textTransform: 'uppercase',
  },
  infoBoxContent: {
    backgroundColor: '#f8fafc',
    padding: 10,
    borderRadius: 4,
  },
  patientName: {
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 3,
  },
  patientDetail: {
    fontSize: 9,
    color: '#444',
    marginBottom: 2,
  },
  table: {
    marginTop: 10,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#2563eb',
    color: '#fff',
    padding: 8,
    fontWeight: 'bold',
    fontSize: 9,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottom: '1 solid #e2e8f0',
    padding: 8,
    fontSize: 9,
  },
  tableRowAlt: {
    backgroundColor: '#f8fafc',
  },
  colService: {
    flex: 3,
  },
  colQty: {
    flex: 0.7,
    textAlign: 'center',
  },
  colPrice: {
    flex: 1.2,
    textAlign: 'right',
  },
  colDiscount: {
    flex: 1,
    textAlign: 'right',
  },
  colTotal: {
    flex: 1.2,
    textAlign: 'right',
  },
  serviceName: {
    fontWeight: 'bold',
    marginBottom: 2,
  },
  serviceDescription: {
    fontSize: 8,
    color: '#666',
  },
  toothNumber: {
    fontSize: 8,
    color: '#2563eb',
    marginTop: 2,
  },
  totalsSection: {
    marginTop: 20,
    marginLeft: 'auto',
    width: 250,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5,
    borderBottom: '1 solid #e2e8f0',
  },
  totalRowFinal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    backgroundColor: '#2563eb',
    color: '#fff',
    paddingHorizontal: 10,
    marginTop: 5,
    fontWeight: 'bold',
    fontSize: 12,
  },
  totalLabel: {
    fontSize: 10,
  },
  totalAmount: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  notesSection: {
    marginTop: 30,
  },
  notesTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    marginBottom: 5,
    color: '#333',
  },
  notesText: {
    fontSize: 9,
    color: '#666',
    backgroundColor: '#fffbeb',
    padding: 10,
    borderRadius: 4,
    border: '1 solid #fcd34d',
  },
  termsSection: {
    marginTop: 20,
    padding: 10,
    backgroundColor: '#f1f5f9',
    borderRadius: 4,
  },
  termsTitle: {
    fontSize: 9,
    fontWeight: 'bold',
    marginBottom: 5,
    color: '#333',
  },
  termsText: {
    fontSize: 8,
    color: '#666',
    lineHeight: 1.4,
  },
  footer: {
    position: 'absolute',
    bottom: 40,
    left: 40,
    right: 40,
    borderTop: '1 solid #e2e8f0',
    paddingTop: 15,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 9,
    color: '#666',
  },
  validityBadge: {
    backgroundColor: '#dcfce7',
    color: '#166534',
    padding: '4 8',
    borderRadius: 4,
    fontSize: 9,
    fontWeight: 'bold',
  },
  expiredBadge: {
    backgroundColor: '#fee2e2',
    color: '#991b1b',
    padding: '4 8',
    borderRadius: 4,
    fontSize: 9,
    fontWeight: 'bold',
  },
  statusBadge: {
    marginTop: 5,
    alignSelf: 'flex-end',
  },
})

interface QuotePDFProps {
  quote: Quote & {
    patient: Patient
    items: QuoteItem[]
  }
  clinicName: string
  clinicAddress?: string
  clinicPhone?: string
  clinicEmail?: string
}

// Format currency
function formatCurrency(cents: number, currency = 'MXN'): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency,
  }).format(cents / 100)
}

// Format date
function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('es-MX', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

// Check if quote is expired
function isExpired(validUntil: string): boolean {
  return new Date(validUntil) < new Date()
}

// PDF Document component
export function QuotePDF({
  quote,
  clinicName,
  clinicAddress,
  clinicPhone,
  clinicEmail,
}: QuotePDFProps) {
  const patient = quote.patient
  const expired = isExpired(quote.valid_until)

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <View>
              <Text style={styles.clinicName}>{clinicName}</Text>
              {clinicAddress && <Text style={styles.clinicInfo}>{clinicAddress}</Text>}
              {clinicPhone && <Text style={styles.clinicInfo}>Tel: {clinicPhone}</Text>}
              {clinicEmail && <Text style={styles.clinicInfo}>{clinicEmail}</Text>}
            </View>
            <View>
              <Text style={styles.quoteTitle}>PRESUPUESTO</Text>
              <Text style={styles.quoteNumber}>No. {quote.quote_number}</Text>
              <Text style={styles.quoteNumber}>Fecha: {formatDate(quote.quote_date)}</Text>
              <View style={styles.statusBadge}>
                {expired ? (
                  <Text style={styles.expiredBadge}>EXPIRADO</Text>
                ) : (
                  <Text style={styles.validityBadge}>
                    Válido hasta: {formatDate(quote.valid_until)}
                  </Text>
                )}
              </View>
            </View>
          </View>
        </View>

        {/* Patient Info */}
        <View style={styles.infoRow}>
          <View style={styles.infoBox}>
            <Text style={styles.infoBoxTitle}>Datos del Paciente</Text>
            <View style={styles.infoBoxContent}>
              <Text style={styles.patientName}>
                {patient?.first_name} {patient?.last_name}
              </Text>
              {patient?.email && (
                <Text style={styles.patientDetail}>{patient.email}</Text>
              )}
              {patient?.phone && (
                <Text style={styles.patientDetail}>Tel: {patient.phone}</Text>
              )}
              {patient?.address && (
                <Text style={styles.patientDetail}>{patient.address}</Text>
              )}
            </View>
          </View>
          <View style={styles.infoBox}>
            <Text style={styles.infoBoxTitle}>Resumen</Text>
            <View style={styles.infoBoxContent}>
              <Text style={styles.patientDetail}>
                Servicios: {quote.items?.length || 0}
              </Text>
              <Text style={styles.patientDetail}>
                Validez: {quote.validity_days} días
              </Text>
              <Text style={[styles.patientName, { marginTop: 5 }]}>
                Total: {formatCurrency(quote.total_cents)}
              </Text>
            </View>
          </View>
        </View>

        {/* Services Table */}
        <View style={styles.table}>
          {/* Table Header */}
          <View style={styles.tableHeader}>
            <Text style={styles.colService}>Servicio</Text>
            <Text style={styles.colQty}>Cant.</Text>
            <Text style={styles.colPrice}>Precio Unit.</Text>
            <Text style={styles.colDiscount}>Desc.</Text>
            <Text style={styles.colTotal}>Total</Text>
          </View>

          {/* Table Rows */}
          {quote.items?.map((item, index) => (
            <View
              key={item.id || index}
              style={[styles.tableRow, index % 2 === 1 && styles.tableRowAlt]}
            >
              <View style={styles.colService}>
                <Text style={styles.serviceName}>{item.service_name}</Text>
                {item.service_description && (
                  <Text style={styles.serviceDescription}>
                    {item.service_description}
                  </Text>
                )}
                {item.tooth_number && (
                  <Text style={styles.toothNumber}>
                    Diente: {item.tooth_number}
                  </Text>
                )}
                {item.notes && (
                  <Text style={styles.serviceDescription}>{item.notes}</Text>
                )}
              </View>
              <Text style={styles.colQty}>{item.quantity}</Text>
              <Text style={styles.colPrice}>
                {formatCurrency(item.unit_price_cents)}
              </Text>
              <Text style={styles.colDiscount}>
                {item.discount_cents && item.discount_cents > 0
                  ? `-${formatCurrency(item.discount_cents)}`
                  : '-'}
              </Text>
              <Text style={styles.colTotal}>
                {formatCurrency(item.total_cents)}
              </Text>
            </View>
          ))}
        </View>

        {/* Totals */}
        <View style={styles.totalsSection}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Subtotal:</Text>
            <Text style={styles.totalAmount}>
              {formatCurrency(quote.subtotal_cents)}
            </Text>
          </View>

          {quote.discount_cents && quote.discount_cents > 0 && (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>
                Descuento
                {quote.discount_type === 'percentage' &&
                  ` (${quote.discount_value}%)`}
                :
              </Text>
              <Text style={[styles.totalAmount, { color: '#dc2626' }]}>
                -{formatCurrency(quote.discount_cents)}
              </Text>
            </View>
          )}

          {quote.tax_cents && quote.tax_cents > 0 && (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>
                IVA ({quote.tax_rate}%):
              </Text>
              <Text style={styles.totalAmount}>
                {formatCurrency(quote.tax_cents)}
              </Text>
            </View>
          )}

          <View style={styles.totalRowFinal}>
            <Text>TOTAL:</Text>
            <Text>{formatCurrency(quote.total_cents)}</Text>
          </View>
        </View>

        {/* Patient Notes */}
        {quote.patient_notes && (
          <View style={styles.notesSection}>
            <Text style={styles.notesTitle}>Notas Importantes</Text>
            <Text style={styles.notesText}>{quote.patient_notes}</Text>
          </View>
        )}

        {/* Terms and Conditions */}
        {quote.terms_conditions && (
          <View style={styles.termsSection}>
            <Text style={styles.termsTitle}>Términos y Condiciones</Text>
            <Text style={styles.termsText}>{quote.terms_conditions}</Text>
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer}>
          <View style={styles.footerRow}>
            <Text>Este presupuesto no constituye un compromiso de servicio.</Text>
            <Text>Generado el {formatDate(new Date().toISOString())}</Text>
          </View>
        </View>
      </Page>
    </Document>
  )
}

// Function to generate PDF buffer
export async function generateQuotePDF(
  quote: Quote & {
    patient: Patient
    items: QuoteItem[]
  },
  clinicName: string,
  clinicAddress?: string,
  clinicPhone?: string,
  clinicEmail?: string
): Promise<Buffer> {
  const buffer = await renderToBuffer(
    <QuotePDF
      quote={quote}
      clinicName={clinicName}
      clinicAddress={clinicAddress}
      clinicPhone={clinicPhone}
      clinicEmail={clinicEmail}
    />
  )
  return Buffer.from(buffer)
}
