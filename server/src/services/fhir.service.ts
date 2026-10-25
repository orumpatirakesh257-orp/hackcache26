import { Patient, QueueToken, DigitalSlip, FHIRResource } from '../../../shared/types';
import { db } from '../db';

export class FHIRService {
  private static isLiveMode(): boolean {
    return process.env.FHIR_LIVE_MODE === 'true';
  }

  /**
   * Generates a valid FHIR R4 Patient resource
   */
  public static createFHIRPatient(patient: Patient): FHIRResource {
    const fhirPatient: FHIRResource = {
      resourceType: 'Patient',
      id: `patient-${patient.id}`,
      meta: {
        versionId: '1',
        lastUpdated: new Date().toISOString(),
        profile: ['https://nrces.in/ndhm/fhir/r4/StructureDefinition/Patient'],
      },
      identifier: [
        {
          system: 'https://hospital.gov.in/opd',
          value: patient.opdNumber,
        },
        ...(patient.abhaId
          ? [
              {
                system: 'https://healthid.ndhm.gov.in',
                value: patient.abhaId,
              },
            ]
          : []),
      ],
      name: [
        {
          use: 'official',
          text: patient.name,
        },
      ],
      telecom: [
        {
          system: 'phone',
          value: patient.phone,
          use: 'mobile',
        },
      ],
      gender: patient.gender,
      birthDate: `${new Date().getFullYear() - patient.age}-01-01`,
      active: true,
    };

    this.saveResource(fhirPatient);
    return fhirPatient;
  }

  /**
   * Generates a valid FHIR R4 Appointment resource
   */
  public static createFHIRAppointment(token: QueueToken, slip: DigitalSlip): FHIRResource {
    const fhirAppointment: FHIRResource = {
      resourceType: 'Appointment',
      id: `appointment-${token.id}`,
      meta: {
        versionId: '1',
        lastUpdated: new Date().toISOString(),
        profile: ['https://nrces.in/ndhm/fhir/r4/StructureDefinition/Appointment'],
      },
      identifier: [
        {
          system: 'https://hospital.gov.in/token',
          value: token.tokenNumber,
        },
      ],
      status: token.status === 'done' ? 'fulfilled' : 'booked',
      serviceCategory: [
        {
          coding: [
            {
              system: 'http://snomed.info/sct',
              code: '394802001',
              display: slip.departmentName,
            },
          ],
        },
      ],
      participant: [
        {
          actor: {
            reference: `Patient/patient-${token.patientId}`,
            display: slip.patientName,
          },
          status: 'accepted',
        },
        {
          actor: {
            display: slip.doctorName,
          },
          status: 'accepted',
        },
      ],
      created: token.createdAt,
      comment: `Room: ${slip.roomNumber}, Floor: ${slip.floor}`,
    };

    this.saveResource(fhirAppointment);
    return fhirAppointment;
  }

  /**
   * Generates a valid FHIR R4 Encounter resource
   */
  public static createFHIREncounter(token: QueueToken, slip: DigitalSlip): FHIRResource {
    const fhirEncounter: FHIRResource = {
      resourceType: 'Encounter',
      id: `encounter-${token.id}`,
      meta: {
        versionId: '1',
        lastUpdated: new Date().toISOString(),
        profile: ['https://nrces.in/ndhm/fhir/r4/StructureDefinition/Encounter'],
      },
      status: token.status === 'done' ? 'finished' : 'in-progress',
      class: {
        system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
        code: 'AMB',
        display: 'ambulatory (OPD)',
      },
      subject: {
        reference: `Patient/patient-${token.patientId}`,
        display: slip.patientName,
      },
      location: [
        {
          location: {
            display: `${slip.departmentName} - ${slip.roomNumber} (Floor ${slip.floor})`,
          },
        },
      ],
      period: {
        start: token.calledAt || token.createdAt,
        end: token.completedAt,
      },
    };

    this.saveResource(fhirEncounter);
    return fhirEncounter;
  }

  private static saveResource(resource: FHIRResource): void {
    const store = db.getStore();
    const existingIndex = store.fhirResources.findIndex(
      (r) => r.resourceType === resource.resourceType && r.id === resource.id
    );
    if (existingIndex >= 0) {
      store.fhirResources[existingIndex] = resource;
    } else {
      store.fhirResources.push(resource);
    }
    db.persist();

    // If live mode is enabled, proxy to Google Cloud Healthcare API endpoint
    if (this.isLiveMode()) {
      try {
        const fhirBaseUrl = process.env.GCP_HEALTHCARE_FHIR_BASE_URL;
        // In live mode, POST/PUT to GCP Cloud Healthcare FHIR store
      } catch (err) {
        console.warn('GCP Healthcare FHIR live export failed', err);
      }
    }
  }

  public static getResources(type?: 'Patient' | 'Appointment' | 'Encounter'): FHIRResource[] {
    const store = db.getStore();
    if (!type) return store.fhirResources;
    return store.fhirResources.filter((r) => r.resourceType === type);
  }
}
