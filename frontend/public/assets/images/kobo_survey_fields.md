# Kobo Form Fields

| type                                             | name                                      | label::Français (fr)                                                                    |
|:-------------------------------------------------|:------------------------------------------|:----------------------------------------------------------------------------------------|
| start                                            | start                                     | nan                                                                                     |
| end                                              | end                                       | nan                                                                                     |
| today                                            | today                                     | nan                                                                                     |
| username                                         | username                                  | nan                                                                                     |
| phonenumber                                      | phonenumber                               | nan                                                                                     |
| integer                                          | Numero_ordre                              | Numero ordre                                                                            |
| calculate                                        | C1                                        | nan                                                                                     |
| calculate                                        | C3                                        | nan                                                                                     |
| calculate                                        | C2                                        | nan                                                                                     |
| calculate                                        | C4                                        | nan                                                                                     |
| calculate                                        | C5                                        | nan                                                                                     |
| begin_group                                      | TYPE_DE_VISITE                            | Menage                                                                                  |
| text                                             | nom_key                                   | Prénom et Nom                                                                           |
| text                                             | telephone_key                             | Telephone                                                                               |
| text                                             | latitude_key                              | Latitude                                                                                |
| text                                             | longitude_key                             | Longitude                                                                               |
| text                                             | region_key                                | Region                                                                                  |
| geopoint                                         | LOCALISATION_CLIENT                       | GPS du Ménage                                                                           |
| select_one roles                                 | role                                      | Votre Role                                                                              |
| begin_group                                      | group_ed3yt17                             | 👷PREPARATEUR KIT                                                                        |
| integer                                          | Nombre_de_KIT_pr_par                      | Nombre de KIT préparé                                                                   |
| integer                                          | Nombre_de_KIT_Charg_pour_livraison        | Nombre de KIT Chargé pour livraison                                                     |
| begin_group                                      | group_wu8kv54                             | 👷LIVREUR                                                                                |
| note                                             | note_Livreur                              | ÉTAPE 1/4: LIVREUR                                                                      |
| select_one cj3rh91                               | Situation_du_M_nage                       | Situation du Ménage                                                                     |
| select_multiple pr4rq21                          | justificatif                              | justificatif                                                                            |
| begin_group                                      | group_sy9vj14                             | formulaire                                                                              |
| integer                                          | Longueur_câble_2_5mm_Int_rieure           | Longueur câble 2,5mm² Intérieure                                                        |
| integer                                          | Longueur_câble_1_5mm_Int_rieure           | Longueur câble 1,5mm² Intérieure                                                        |
| integer                                          | Longueur_Tranch_e_câble_arm_4mm           | Longueur Tranchée (câble armé 4mm²)                                                     |
| integer                                          | Longueur_Tranch_e_C_ble_arm_1_5mm         | Longueur Tranchée Câble armé 1,5mm²)                                                    |
| acknowledge                                      | Je_confirme_la_remis_u_materiel_au_m_nage | Je confirme la remise du materiel au ménage                                             |
| acknowledge                                      | Je_confirme_le_marqu_osition_des_coffrets | Je confirme le marquage de la position du Mur et position des coffrets                  |
| select_one pg7bi79                               | New_Question                              | New Question                                                                            |
| acknowledge                                      | Je_confirme_le_marqu_s_coffret_lectrique  | Je confirme le marquage de l'emplacement des coffret électrique                         |
| image                                            | Photo                                     | Photo                                                                                   |
| begin_group                                      | etape_macon                               | 👷 ÉTAPE MAÇON - RÉALISATION DU MUR                                                      |
| note                                             | note_macon_1                              | ÉTAPE 2/4: RÉALISATION DU MUR                                                           |
| select_one kit_disponible                        | kit_disponible_macon                      | Le kit est-il disponible et complet ?                                                   |
| select_multiple problemes_kit_macon              | problemes_kit_macon                       | POURQUOI?                                                                               |
| select_one type_mur                              | type_mur_realise_macon                    | Type de Mur                                                                             |
| select_multiple problemes_travail_macon          | problemes_travail_macon                   | PROBLEME                                                                                |
| acknowledge                                      | validation_macon_final                    | ✅ Je valide que le mur est terminé et conforme                                          |
| begin_group                                      | etape_reseau                              | 🔌 ÉTAPE RÉSEAU - BRANCHEMENT                                                            |
| note                                             | note_reseau_1                             | ÉTAPE 3/4: BRANCHEMENT                                                                  |
| select_one verification_mur                      | verification_mur_reseau                   | Le mur est-il réalisé et conforme ?                                                     |
| select_multiple problemes_mur_reseau             | problemes_mur_reseau                      | Problèmes avec le mur                                                                   |
| select_one etat_branchement                      | etat_branchement_reseau                   | État du branchement                                                                     |
| select_multiple problemes_branchement_reseau     | problemes_branchement_reseau              | Problèmes lors du branchement                                                           |
| acknowledge                                      | validation_reseau_final                   | ✅ Je valide que le branchement est terminé et conforme                                  |
| begin_group                                      | etape_interieur                           | 💡 ÉTAPE INTÉRIEUR - INSTALLATION                                                        |
| note                                             | note_interieur_1                          | ÉTAPE 4/4: INSTALLATION INTÉRIEURE                                                      |
| select_one verification_branchement              | verification_branchement_interieur        | Le branchement est-il réalisé et conforme ?                                             |
| select_multiple problemes_branchement_interieur  | problemes_branchement_interieur           | Problèmes avec le branchement                                                           |
| select_one etat_installation                     | etat_installation_interieur               | État de l'installation intérieure réalisée                                              |
| select_multiple problemes_installation_interieur | problemes_installation_interieur          | Problèmes lors de l'installation intérieure                                             |
| acknowledge                                      | validation_interieur_final                | ✅ Je valide que l'installation intérieure est terminée et conforme                      |
| begin_group                                      | etape_controleur                          | 🔍 ÉTAPE CONTRÔLEUR - VÉRIFICATION FINALE                                                |
| select_one rr4dg37                               | ETAT_DE_L_INSTALLATION                    | Controle préalable                                                                      |
| select_multiple oo84j36                          | controleurPROB                            | Quel est le probleme ?                                                                  |
| select_one ga7rh54                               | Phase_de_controle                         | Phase du contrôle                                                                       |
| begin_group                                      | group_zw7xz94                             | 👷Controle Branchement                                                                   |
| select_one sv3tg34                               | ETAT_BRANCHEMENT                          | ETAT DU BRANCHEMENT                                                                     |
| select_multiple kx9fr02                          | OBSERVATION                               | OBSERVATION???                                                                          |
| begin_group                                      | group_wr05k35                             | Installation extérieure (Branchement)                                                   |
| select_one lo9ia24                               | Position_du_branchement                   | Position et longueur du branchement sur le réseau                                       |
| select_multiple la7vc77                          | Observations_sur_la_ition_du_branchement  | Observations sur la position du branchement                                             |
| select_one nk1mo89                               | Hauteur_branchement                       | Hauteur branchement                                                                     |
| text                                             | Observations                              | Observations                                                                            |
| select_one nk1mo89                               | Hauteur_coffret                           | Hauteur du coffret                                                                      |
| text                                             | Observations_001                          | Observations                                                                            |
| select_one ur9iq73                               | Etat_du_coupe_circuit                     | Etat du coupe circuit?                                                                  |
| select_multiple rz78v01                          | OBSERVATION_001                           | OBSERVATION???                                                                          |
| select_one nk1mo89                               | Continuit_PVC                             | Isolation coffret et protection descente câble                                          |
| select_multiple fv5uq33                          | OBSERVATION_002                           | OBSERVATION???                                                                          |
| select_one nk1mo89                               | Mise_en_oeuvre                            | Mise en œuvre du Branchement                                                            |
| select_multiple ey6uw71                          | OBSERVATION_003                           | OBSERVATION???                                                                          |
| image                                            | _1_photo_anomalie_si_possible             | 1 photo anomalie si existant                                                            |
| begin_group                                      | group_hx7ae46                             | 👷Controle installation Intérieure                                                       |
| select_one el0wa18                               | DISJONCTEUR_GENERAL_EN_TETE_D_            | DISJONCTEUR GENERAL EN TETE D'INSTALLATION                                              |
| select_multiple zs4mw04                          | OBSERVATIONS_                             | OBSERVATIONS ???                                                                        |
| select_one nr78z46                               | TYPE_DE_DISJONCTEUR_GENERAL               | TYPE DE DISJONCTEUR GENERAL                                                             |
| select_one gk2qz88                               | ENSEMBLE_DE_L_INSTALLATION_PRO            | ENSEMBLE DE L'INSTALLATION PROTÉGÉ PAR DDR 30mA                                         |
| select_multiple py9cc56                          | OBSERVATIONS__001                         | OBSERVATIONS ???                                                                        |
| select_one nm4md59                               | PROTECTION_L_ORIGINE_DE_CHAQ              | PROTECTION À L'ORIGINE DE CHAQUE CIRCUIT (Modulaire et conducteur)                      |
| select_multiple nr8tv95                          | OBSERVATIONS_002                          | OBSERVATIONS???                                                                         |
| select_one nm4md59                               | S_PARATION_DES_CIRCUITS_Lumi_             | SÉPARATION DES CIRCUITS (Lumière et Prise)                                              |
| text                                             | OBSERVATIONS__002                         | OBSERVATIONS ???                                                                        |
| note                                             | PROTECTION_CONTACT_D_TOUTE_L_INSTALLATION | PROTECTION CONTACT DIRECT A VERIFIER SUR TOUTE L'INSTALLATION                           |
| select_one bm2rn03                               | PROTECTION_CONTRE_LES_CONTACTS            | PROTECTION CONTRE LES CONTACTS DIRECTS                                                  |
| select_multiple ps4nb23                          | OBSERVATIONS__003                         | OBSERVATIONS ???                                                                        |
| select_one nm4md59                               | MISE_EN_OEUVRE_MAT_RIEL_ET_APP            | MISE EN OEUVRE MATÉRIEL ET APPAREILLAGE (Coffret, Prise, Interrupteur, Boite, Câble...) |
| select_multiple jm8qy41                          | OBSERVATIONS__004                         | OBSERVATIONS ???                                                                        |
| select_one nm4md59                               | CONTINUITE_DE_LA_PROTECTION_ME            | CONTINUITE DE LA PROTECTION MECANIQUE DES FILS CONDUCTEURS (Phase /neutre/Terre)        |
| select_multiple vo5kj15                          | OBSERVATIONS__005                         | OBSERVATIONS ???                                                                        |
| note                                             | RESEAU_DE_TERRE_A_VE_TOUTE_L_INSTALLATION | RESEAU DE TERRE A VERIFIER SUR TOUTE L'INSTALLATION                                     |
| select_one nm4md59                               | MISE_EN_UVRE_DU_R_SEAU_DE_TER             | MISE EN ŒUVRE DU RÉSEAU DE TERRE et CONTINUITE                                          |
| select_multiple pi0xx78                          | OBSERVATIONS__006                         | OBSERVATIONS ???                                                                        |
| select_one lk4xz51                               | ETAT_DE_LA_BARRETTE_DE_TERRE              | ETAT DE LA BARRETTE DE TERRE                                                            |
| select_one nm4md59                               | VALEUR_DE_LA_RESISTANCE_DE_TER            | VALEUR DE LA RESISTANCE DE TERRE OU DE BOUCLE                                           |
| integer                                          | OBSERVATIONS__007                         | OBSERVATIONS ???                                                                        |
| acknowledge                                      | validation_controleur_final               | ✅ Je valide le contrôle et l'installation est conforme                                  |
| text                                             | notes_generales                           | Notes générales                                                                         |