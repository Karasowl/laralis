import React from 'react'
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
} from '@react-pdf/renderer'
import type { Prescription, PrescriptionItem, Patient } from '@/lib/types'

// Styles for the prescription PDF
const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: 'Helvetica',
  },
  header: {
    marginBottom: 20,
    borderBottom: '1 solid #333',
    paddingBottom: 15,
  },
  clinicName: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 5,
    textAlign: 'center',
  },
  prescriptionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
    color: '#444',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  headerItem: {
    fontSize: 9,
  },
  section: {
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#333',
    borderBottom: '1 solid #eee',
    paddingBottom: 3,
  },
  patientInfo: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  patientField: {
    width: '50%',
    marginBottom: 5,
  },
  label: {
    fontSize: 8,
    color: '#666',
    marginBottom: 2,
  },
  value: {
    fontSize: 10,
  },
  diagnosis: {
    padding: 10,
    backgroundColor: '#f9f9f9',
    borderRadius: 4,
    marginBottom: 15,
  },
  diagnosisLabel: {
    fontSize: 8,
    color: '#666',
    marginBottom: 3,
  },
  diagnosisText: {
    fontSize: 10,
  },
  medicationList: {
    marginTop: 10,
  },
  medicationItem: {
    marginBottom: 12,
    padding: 10,
    backgroundColor: '#f5f5f5',
    borderRadius: 4,
    borderLeft: '3 solid #4a90d9',
  },
  medicationName: {
    fontSize: 11,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  medicationDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  medicationDetail: {
    marginRight: 15,
    marginBottom: 3,
  },
  detailLabel: {
    fontSize: 8,
    color: '#666',
  },
  detailValue: {
    fontSize: 9,
  },
  instructions: {
    marginTop: 5,
    padding: 5,
    backgroundColor: '#fff',
    borderRadius: 2,
  },
  instructionsLabel: {
    fontSize: 8,
    color: '#666',
    marginBottom: 2,
  },
  instructionsText: {
    fontSize: 9,
    fontStyle: 'italic',
  },
  pharmacyNotes: {
    marginTop: 15,
    padding: 10,
    backgroundColor: '#fffbeb',
    borderRadius: 4,
    border: '1 solid #fcd34d',
  },
  pharmacyNotesTitle: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#92400e',
    marginBottom: 5,
  },
  pharmacyNotesText: {
    fontSize: 9,
    color: '#78350f',
  },
  footer: {
    position: 'absolute',
    bottom: 40,
    left: 40,
    right: 40,
  },
  signature: {
    marginTop: 30,
    borderTop: '1 solid #333',
    paddingTop: 10,
    width: 200,
    marginLeft: 'auto',
    marginRight: 'auto',
    textAlign: 'center',
  },
  signatureName: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  signatureDetails: {
    fontSize: 8,
    color: '#666',
  },
  validity: {
    marginTop: 15,
    textAlign: 'center',
    fontSize: 8,
    color: '#666',
  },
  watermark: {
    position: 'absolute',
    top: 300,
    left: 100,
    fontSize: 60,
    color: '#f0f0f0',
    transform: 'rotate(-45deg)',
    opacity: 0.5,
  },
})

interface PrescriptionPDFProps {
  prescription: Prescription & {
    patient: Patient
    items: PrescriptionItem[]
  }
  clinicName: string
  clinicAddress?: string
  clinicPhone?: string
}

// PDF Document component
export function PrescriptionPDF({
  prescription,
  clinicName,
  clinicAddress,
  clinicPhone,
}: PrescriptionPDFProps) {
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('es-MX', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  const calculateAge = (birthDate?: string) => {
    if (!birthDate) return null
    const today = new Date()
    const birth = new Date(birthDate)
    let age = today.getFullYear() - birth.getFullYear()
    const monthDiff = today.getMonth() - birth.getMonth()
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--
    }
    return age
  }

  const patient = prescription.patient
  const patientAge = patient?.birth_date ? calculateAge(patient.birth_date) : null

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        {/* Watermark for cancelled prescriptions */}
        {prescription.status === 'cancelled' && (
          <Text style={styles.watermark}>CANCELADA</Text>
        )}

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.clinicName}>{clinicName}</Text>
          {clinicAddress && (
            <Text style={{ textAlign: 'center', fontSize: 9, color: '#666' }}>
              {clinicAddress}
            </Text>
          )}
          {clinicPhone && (
            <Text style={{ textAlign: 'center', fontSize: 9, color: '#666' }}>
              Tel: {clinicPhone}
            </Text>
          )}
          <Text style={styles.prescriptionTitle}>RECETA MÉDICA</Text>
          <View style={styles.headerRow}>
            <Text style={styles.headerItem}>
              No. {prescription.prescription_number}
            </Text>
            <Text style={styles.headerItem}>
              Fecha: {formatDate(prescription.prescription_date)}
            </Text>
          </View>
        </View>

        {/* Patient Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>DATOS DEL PACIENTE</Text>
          <View style={styles.patientInfo}>
            <View style={styles.patientField}>
              <Text style={styles.label}>Nombre</Text>
              <Text style={styles.value}>
                {patient?.first_name} {patient?.last_name}
              </Text>
            </View>
            {patientAge !== null && (
              <View style={styles.patientField}>
                <Text style={styles.label}>Edad</Text>
                <Text style={styles.value}>{patientAge} años</Text>
              </View>
            )}
            {patient?.address && (
              <View style={styles.patientField}>
                <Text style={styles.label}>Dirección</Text>
                <Text style={styles.value}>{patient.address}</Text>
              </View>
            )}
            {patient?.phone && (
              <View style={styles.patientField}>
                <Text style={styles.label}>Teléfono</Text>
                <Text style={styles.value}>{patient.phone}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Diagnosis */}
        {prescription.diagnosis && (
          <View style={styles.diagnosis}>
            <Text style={styles.diagnosisLabel}>DIAGNÓSTICO</Text>
            <Text style={styles.diagnosisText}>{prescription.diagnosis}</Text>
          </View>
        )}

        {/* Medications */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>MEDICAMENTOS</Text>
          <View style={styles.medicationList}>
            {prescription.items?.map((item, index) => (
              <View key={item.id || index} style={styles.medicationItem}>
                <Text style={styles.medicationName}>
                  {index + 1}. {item.medication_name}
                  {item.medication_strength && ` ${item.medication_strength}`}
                  {item.medication_form && ` - ${item.medication_form}`}
                </Text>
                <View style={styles.medicationDetails}>
                  <View style={styles.medicationDetail}>
                    <Text style={styles.detailLabel}>Dosis</Text>
                    <Text style={styles.detailValue}>{item.dosage}</Text>
                  </View>
                  <View style={styles.medicationDetail}>
                    <Text style={styles.detailLabel}>Frecuencia</Text>
                    <Text style={styles.detailValue}>{item.frequency}</Text>
                  </View>
                  {item.duration && (
                    <View style={styles.medicationDetail}>
                      <Text style={styles.detailLabel}>Duración</Text>
                      <Text style={styles.detailValue}>{item.duration}</Text>
                    </View>
                  )}
                  {item.quantity && (
                    <View style={styles.medicationDetail}>
                      <Text style={styles.detailLabel}>Cantidad</Text>
                      <Text style={styles.detailValue}>{item.quantity}</Text>
                    </View>
                  )}
                </View>
                {item.instructions && (
                  <View style={styles.instructions}>
                    <Text style={styles.instructionsLabel}>Indicaciones</Text>
                    <Text style={styles.instructionsText}>{item.instructions}</Text>
                  </View>
                )}
              </View>
            ))}
          </View>
        </View>

        {/* Pharmacy Notes */}
        {prescription.pharmacy_notes && (
          <View style={styles.pharmacyNotes}>
            <Text style={styles.pharmacyNotesTitle}>NOTAS PARA LA FARMACIA</Text>
            <Text style={styles.pharmacyNotesText}>{prescription.pharmacy_notes}</Text>
          </View>
        )}

        {/* Footer with signature */}
        <View style={styles.footer}>
          <View style={styles.signature}>
            <Text style={styles.signatureName}>{prescription.prescriber_name}</Text>
            {prescription.prescriber_license && (
              <Text style={styles.signatureDetails}>
                Cédula Prof.: {prescription.prescriber_license}
              </Text>
            )}
            {prescription.prescriber_specialty && (
              <Text style={styles.signatureDetails}>
                {prescription.prescriber_specialty}
              </Text>
            )}
          </View>

          {prescription.valid_until && (
            <Text style={styles.validity}>
              Esta receta es válida hasta el {formatDate(prescription.valid_until)}
            </Text>
          )}
        </View>
      </Page>
    </Document>
  )
}

// Function to generate PDF buffer
export async function generatePrescriptionPDF(
  prescription: Prescription & {
    patient: Patient
    items: PrescriptionItem[]
  },
  clinicName: string,
  clinicAddress?: string,
  clinicPhone?: string
): Promise<Buffer> {
  const buffer = await renderToBuffer(
    <PrescriptionPDF
      prescription={prescription}
      clinicName={clinicName}
      clinicAddress={clinicAddress}
      clinicPhone={clinicPhone}
    />
  )
  return Buffer.from(buffer)
}
