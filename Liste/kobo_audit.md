# Kobo Survey Audit

| Type | Name | Label (FR) | Required |
| --- | --- | --- | --- |
| start | start | nan | nan |
| end | end | nan | nan |
| today | today | nan | nan |
| username | username | nan | nan |
| phonenumber | phonenumber | nan | nan |
| integer | Numero_ordre | Numero ordre | True |
| calculate | C1 | nan | True |
| calculate | C3 | nan | True |
| calculate | C2 | nan | True |
| calculate | C4 | nan | False |
| calculate | C5 | nan | False |
| begin_group | TYPE_DE_VISITE | Menage | False |
| text | nom_key | Prénom et Nom | True |
| text | telephone_key | Telephone | True |
| text | latitude_key | Latitude | True |
| text | longitude_key | Longitude | True |
| text | region_key | Region | True |
| geopoint | LOCALISATION_CLIENT | GPS du Ménage | True |
| select_one roles | role | Votre Role | True |
| end_group | nan | nan | nan |
| begin_group | group_ed3yt17 | 👷PREPARATEUR KIT | nan |
| integer | Nombre_de_KIT_pr_par | Nombre de KIT préparé | False |
| integer | Nombre_de_KIT_Charg_pour_livraison | Nombre de KIT Chargé pour livraison | False |
| end_group | nan | nan | nan |
| begin_group | group_wu8kv54 | 👷LIVREUR | False |
| note | note_Livreur | ÉTAPE 1/4: LIVREUR | False |
| select_one cj3rh91 | Situation_du_M_nage | Situation du Ménage | False |
| select_multiple pr4rq21 | justificatif | justificatif | False |
| begin_group | group_sy9vj14 | formulaire | False |
| integer | Longueur_Cable_2_5mm_Int_rieure | Longueur Cable 2,5mm² Intérieure | True |
| integer | Longueur_Cable_1_5mm_Int_rieure | Longueur Cable 1,5mm² Intérieure | True |
| integer | Longueur_Tranch_e_Cable_arm_4mm | Longueur Tranchée (Cable armé 4mm²) | True |
| integer | Longueur_Tranch_e_C_ble_arm_1_5mm | Longueur Tranchée Câble armé 1,5mm²) | True |
| acknowledge | Je_confirme_la_remis_u_materiel_au_m_nage | Je confirme la remise du materiel au ménage | True |
| acknowledge | Je_confirme_le_marqu_osition_des_coffrets | Je confirme le marquage de la position du Mur et position des coffrets | True |
| select_one pg7bi79 | New_Question | New Question | False |
| acknowledge | Je_confirme_le_marqu_s_coffret_lectrique | Je confirme le marquage de l'emplacement des coffret électrique | True |
| image | Photo | Photo | False |
| end_group | nan | nan | nan |
| end_group | nan | nan | nan |
| begin_group | etape_macon | 👷 ÉTAPE MAÇON - RÉALISATION DU MUR | False |
| note | note_macon_1 | ÉTAPE 2/4: RÉALISATION DU MUR | False |
| select_one kit_disponible | kit_disponible_macon | Le kit est-il disponible et complet ? | True |
| select_multiple problemes_kit_macon | problemes_kit_macon | POURQUOI? | False |
| select_one type_mur | type_mur_realise_macon | Type de Mur | True |
| select_multiple problemes_travail_macon | problemes_travail_macon | PROBLEME | False |
| acknowledge | validation_macon_final | ✅ Je valide que le mur est terminé et conforme | True |
| end_group | nan | nan | nan |
| begin_group | etape_reseau | 🔌 ÉTAPE RÉSEAU - BRANCHEMENT | False |
| note | note_reseau_1 | ÉTAPE 3/4: BRANCHEMENT | False |
| select_one verification_mur | verification_mur_reseau | Le mur est-il réalisé et conforme ? | True |
| select_multiple problemes_mur_reseau | problemes_mur_reseau | Problèmes avec le mur | True |
| select_one etat_branchement | etat_branchement_reseau | État du branchement | True |
| select_multiple problemes_branchement_reseau | problemes_branchement_reseau | Problèmes lors du branchement | False |
| acknowledge | validation_reseau_final | ✅ Je valide que le branchement est terminé et conforme | True |
| end_group | nan | nan | nan |
| begin_group | etape_interieur | 💡 ÉTAPE INTÉRIEUR - INSTALLATION | False |
| note | note_interieur_1 | ÉTAPE 4/4: INSTALLATION INTÉRIEURE | False |
| select_one verification_branchement | verification_branchement_interieur | Le branchement est-il réalisé et conforme ? | True |
| select_multiple problemes_branchement_interieur | problemes_branchement_interieur | Problèmes avec le branchement | False |
| select_one etat_installation | etat_installation_interieur | État de l'installation intérieure réalisée | True |
| select_multiple problemes_installation_interieur | problemes_installation_interieur | Problèmes lors de l'installation intérieure | False |
| acknowledge | validation_interieur_final | ✅ Je valide que l'installation intérieure est terminée et conforme | True |
| end_group | nan | nan | nan |
| begin_group | etape_controleur | 🔍 ÉTAPE CONTRÔLEUR - VÉRIFICATION FINALE | False |
| select_one rr4dg37 | ETAT_DE_L_INSTALLATION | Controle préalable | True |
| select_multiple oo84j36 | controleurPROB | Quel est le probleme ? | True |
| select_one ga7rh54 | Phase_de_controle | Phase du contrôle | True |
| begin_group | group_zw7xz94 | 👷Controle Branchement | False |
| select_one sv3tg34 | ETAT_BRANCHEMENT | ETAT DU BRANCHEMENT | True |
| select_multiple kx9fr02 | OBSERVATION | OBSERVATION??? | True |
| begin_group | group_wr05k35 | Installation extérieure (Branchement) | False |
| select_one lo9ia24 | Position_du_branchement | Position et longueur du branchement sur le réseau | True |
| select_multiple la7vc77 | Observations_sur_la_ition_du_branchement | Observations sur la position du branchement | True |
| select_one nk1mo89 | Hauteur_branchement | Hauteur branchement | True |
| text | Observations | Observations | True |
| select_one nk1mo89 | Hauteur_coffret | Hauteur du coffret | True |
| text | Observations_001 | Observations | True |
| select_one ur9iq73 | Etat_du_coupe_circuit | Etat du coupe circuit? | False |
| select_multiple rz78v01 | OBSERVATION_001 | OBSERVATION??? | True |
| select_one nk1mo89 | Continuit_PVC | Isolation coffret et protection descente câble | True |
| select_multiple fv5uq33 | OBSERVATION_002 | OBSERVATION??? | True |
| select_one nk1mo89 | Mise_en_oeuvre | Mise en œuvre du Branchement | True |
| select_multiple ey6uw71 | OBSERVATION_003 | OBSERVATION??? | True |
| image | _1_photo_anomalie_si_possible | 1 photo anomalie si existant | False |
| end_group | nan | nan | nan |
| end_group | nan | nan | nan |
| begin_group | group_hx7ae46 | 👷Controle installation Intérieure | False |
| select_one el0wa18 | DISJONCTEUR_GENERAL_EN_TETE_D_ | DISJONCTEUR GENERAL EN TETE D'INSTALLATION | True |
| select_multiple zs4mw04 | OBSERVATIONS_ | OBSERVATIONS ??? | True |
| select_one nr78z46 | TYPE_DE_DISJONCTEUR_GENERAL | TYPE DE DISJONCTEUR GENERAL | True |
| select_one gk2qz88 | ENSEMBLE_DE_L_INSTALLATION_PRO | ENSEMBLE DE L'INSTALLATION PROTÉGÉ PAR DDR 30mA | True |
| select_multiple py9cc56 | OBSERVATIONS__001 | OBSERVATIONS ??? | True |
| select_one nm4md59 | PROTECTION_L_ORIGINE_DE_CHAQ | PROTECTION À L'ORIGINE DE CHAQUE CIRCUIT (Modulaire et conducteur) | True |
| select_multiple nr8tv95 | OBSERVATIONS_002 | OBSERVATIONS??? | True |
| select_one nm4md59 | S_PARATION_DES_CIRCUITS_Lumi_ | SÉPARATION DES CIRCUITS (Lumière et Prise) | True |
| text | OBSERVATIONS__002 | OBSERVATIONS ??? | True |
| note | PROTECTION_CONTACT_D_TOUTE_L_INSTALLATION | PROTECTION CONTACT DIRECT A VERIFIER SUR TOUTE L'INSTALLATION | False |
| select_one bm2rn03 | PROTECTION_CONTRE_LES_CONTACTS | PROTECTION CONTRE LES CONTACTS DIRECTS | True |
| select_multiple ps4nb23 | OBSERVATIONS__003 | OBSERVATIONS ??? | True |
| select_one nm4md59 | MISE_EN_OEUVRE_MAT_RIEL_ET_APP | MISE EN OEUVRE MATÉRIEL ET APPAREILLAGE (Coffret, Prise, Interrupteur, Boite, Câble...) | True |
| select_multiple jm8qy41 | OBSERVATIONS__004 | OBSERVATIONS ??? | True |
| select_one nm4md59 | CONTINUITE_DE_LA_PROTECTION_ME | CONTINUITE DE LA PROTECTION MECANIQUE DES FILS CONDUCTEURS (Phase /neutre/Terre) | True |
| select_multiple vo5kj15 | OBSERVATIONS__005 | OBSERVATIONS ??? | True |
| note | RESEAU_DE_TERRE_A_VE_TOUTE_L_INSTALLATION | RESEAU DE TERRE A VERIFIER SUR TOUTE L'INSTALLATION | False |
| select_one nm4md59 | MISE_EN_UVRE_DU_R_SEAU_DE_TER | MISE EN ŒUVRE DU RÉSEAU DE TERRE et CONTINUITE | True |
| select_multiple pi0xx78 | OBSERVATIONS__006 | OBSERVATIONS ??? | True |
| select_one lk4xz51 | ETAT_DE_LA_BARRETTE_DE_TERRE | ETAT DE LA BARRETTE DE TERRE | False |
| select_one nm4md59 | VALEUR_DE_LA_RESISTANCE_DE_TER | VALEUR DE LA RESISTANCE DE TERRE OU DE BOUCLE | True |
| integer | OBSERVATIONS__007 | OBSERVATIONS ??? | True |
| end_group | nan | nan | nan |
| acknowledge | validation_controleur_final | ✅ Je valide le contrôle et l'installation est conforme | True |
| end_group | nan | nan | nan |
| text | notes_generales | Notes générales | True |

# Kobo Choices Audit

| List Name | Name | Label (FR) |
| --- | --- | --- |
| roles | livreur | 🛠️ Livreur |
| roles | macon | 👷 Maçon |
| roles | reseau | 🔌 Équipe Réseau |
| roles | interieur | 💡 Équipe Installateur |
| roles | controleur | 🔍 Contrôleur |
| roles | __pr_parateur | 👷 Préparateur |
| cj3rh91 | menage_eligible | Ménage éligible |
| cj3rh91 | menage_non_eligible | Ménage non éligible |
| cj3rh91 | menage_injoignable | Ménage injoignable |
| pr4rq21 | desistement_du_menage | Désistement du ménage/ |
| pr4rq21 | probleme_technique_d_installation | Probleme technique d'installation/ |
| pr4rq21 | maison_en_paille | Maison en paille/ |
| pr4rq21 | probleme_de_fixation_coffret | Probleme de fixation coffret/ |
| pg7bi79 | menage_sans_mur | Ménage sans Mur |
| pg7bi79 | menage_avec_mur | Ménage avec Mur |
| kit_disponible | oui | ✅ Oui - Kit maçon disponible |
| kit_disponible | non | ❌ Non - Kit maçon non disponible |
| problemes_kit_macon | pas_de_kit | ❌ Kit non livré/ |
| problemes_kit_macon | kit_incomplet | ❌ Kit incomplet/ |
| problemes_kit_macon | pas_de_potelet | ❌ Pas de potelet/ |
| problemes_kit_macon | autres_problemes_kit | ❌ Autres problèmes/ |
| type_mur | mur-standard | 🧱 Mur standard (2 poteaux) |
| type_mur | mur_en_chemine | 🚪 Mur en forme de cheminée |
| problemes_travail_macon | terrain_probleme | Problème avec le terrain/ |
| problemes_travail_macon | meteo_probleme | Problème météo/ |
| problemes_travail_macon | materiel_manquant | Matériel manquant/ |
| problemes_travail_macon | autres_problemes_travail | Autres problèmes/ |
| verification_mur | oui | ✅ Oui - Mur conforme |
| verification_mur | non | ❌ Non - Mur non conforme |
| problemes_mur_reseau | mur_non_realise | Mur non réalisé/ |
| problemes_mur_reseau | mur_non_conforme | Mur non conforme/ |
| problemes_mur_reseau | autre_probleme_mur | Autre problème avec le mur/ |
| etat_branchement | termine | ✅ Branchement terminé |
| etat_branchement | probleme | ❌ Problème lors du branchement |
| problemes_branchement_reseau | pas_de_materiel_reseau | Pas de matériel disponible/ |
| problemes_branchement_reseau | probleme_technique_reseau | Problème technique/ |
| problemes_branchement_reseau | autres_problemes_reseau | Autres problèmes/ |
| verification_branchement | oui | ✅ Oui - Branchement conforme |
| verification_branchement | non | ❌ Non - Branchement non conforme |
| problemes_branchement_interieur | branchement_non_realise | Branchement non réalisé/ |
| problemes_branchement_interieur | branchement_non_conforme | Branchement non conforme/ |
| problemes_branchement_interieur | autre_probleme_branchement | Autre problème avec le branchement/ |
| etat_installation | termine | ✅ Installation terminée |
| etat_installation | probleme | ❌ Problème lors de l'installation |
| problemes_installation_interieur | pas_de_materiel_interieur | Pas de matériel disponible/ |
| problemes_installation_interieur | probleme_technique_interieur | Problème technique/ |
| problemes_installation_interieur | autres_problemes_interieur | Autres problèmes/ |
| rr4dg37 | terminee | Terminée |
| rr4dg37 | non_terminee | Non terminée |
| rr4dg37 | non_encore_instalee | Non encore installée |
| rr4dg37 | probleme_a_signaler | ❌ Probleme à signaler |
| oo84j36 | demande_extension | ❌ Demande une extension réseau/ |
| oo84j36 | menage_ineligible2 | ❌ Ménage inéligible/ |
| oo84j36 | menage_no_disponible | ❌ Ménage non disponible (injoignable)/ |
| oo84j36 | confusio_de_menage | ❌ Confusion de ménage/ |
| oo84j36 | __maison_inaccessible | ❌ Maison inaccessible/ |
| ga7rh54 | visite_1 | Première Contrôle |
| ga7rh54 | visite_2 | Mise en conformité |
| ga7rh54 | visite_renouvelee | Visite renouvelée (sans objet) |
| sv3tg34 | realise | Réalisé |
| sv3tg34 | non_realise | Non encore réalisé |
| sv3tg34 | non_termine | Non terminé |
| kx9fr02 | coffret_compteur_non_encore_pos | Coffret compteur non encore posé/ |
| kx9fr02 | potelet_non_encore_pos | Potelet non encore posé/ |
| kx9fr02 | cable_preassemble_non_encore_tire | Câble préassemblé non encore tiré/ |
| kx9fr02 | necessite_une_extension | Nécessite une Extension/ |
| kx9fr02 | pas_de_pince_d_encrages | Pas de pince d'encrages/ |
| kx9fr02 | pas_de_connecteurs | Pas de Connecteurs/ |
| kx9fr02 | pas_de_queue_de_cochon | Pas de queue de cochon/ |
| lo9ia24 | conforme | Conforme |
| lo9ia24 | non_conforme | Non conforme |
| la7vc77 | plus_de_2_positions__zone_urbaine | Le Branchement dépasse la position 2 (Zone Urbaine)/ |
| la7vc77 | plus_de_3_positions__zone_rurale | Le Branchement dépasse la position 3 (Zone Rurale)/ |
| la7vc77 | longueur_branchement_sup_rieure___40m__z | Longueur du branchement supérieure à 40m (Zone Urbaine)/ |
| la7vc77 | longueur_branchement_sup_rieure___50m__z | Longueur du branchement supérieure à 50m (Zone Rurale)/ |
| la7vc77 | necessite_une_extension | Nécessite une Extension/ |
| nk1mo89 | conforme | C |
| nk1mo89 | non_conforme | NC |
| ur9iq73 | c | C |
| ur9iq73 | nc | NC |
| rz78v01 | pas_de_coupe_circuit__cc | Pas de coupe circuit (CC)/ |
| rz78v01 | coupe_circuit_deteriore | Coupe-circuit détérioré/ |
| rz78v01 | calibre_fusible_superieur_25a | Calibre fusible Supérieur à 25A/ |
| fv5uq33 | pas_de_tube_pvc | Pas de tube PVC/ |
| fv5uq33 | protection_mecanique_non_assure_sur_tou | Protection mécanique non assurée sur toute la longueur (descente câble préassemblé)/ |
| fv5uq33 | coffret_compteur_perce | Le Coffret compteur est percé/Troué/ |
| ey6uw71 | mode_de_pose_non_conforme | Mode de pose non conforme (Installation Anarchique)/ |
| ey6uw71 | potelet_trop_inclin | Potelet trop incliné du sens vertical/ |
| ey6uw71 | pas_de_pince_d_encrage | Pas de pince d'encrage/ |
| ey6uw71 | pas_de_queue_de_cochon | Pas de queue de cochon/ |
| ey6uw71 | hauteur_coffret_compteur_trop_bas___inf_ | Hauteur Coffret compteur (Hublot - Sol) INFERIEURE à 1,20m / |
| ey6uw71 | le_c_ble_pr_assembl__est_jonctionn | Le Câble préassemblé est Jonctionné/ |
| ey6uw71 | le_coffret_est_place_interieure_de | Le Coffret compteur est placé à l'intérieure de la limite de propriété de la maison/ |
| ey6uw71 | hauteur_coffret_compteur__hublot___sol__ | Hauteur Coffret compteur (Hublot - Sol) Supérieur à 1,60m/ |
| el0wa18 | conforme | Conforme |
| el0wa18 | non_conforme | Non conforme |
| zs4mw04 | absence_de_disjoncteur_general | Absence de disjoncteur Général/ |
| zs4mw04 | disjoncteur_general_non_fix | Disjoncteur Général Non fixé/ |
| zs4mw04 | disjoncteur_general_deterior | Disjoncteur Général détérioré/ |
| zs4mw04 | disjoncteur_general_non_adapt | Disjoncteur Général non adapté/ |
| zs4mw04 | emplacement_tgbt_non_adequate | Emplacement TGBT non adéquate/ |
| nr78z46 | differentiel | Differentiel |
| nr78z46 | non_differentiel | Non differentiel |
| gk2qz88 | conforme | Conforme |
| gk2qz88 | non_conforme | Non Conforme |
| py9cc56 | differentiel_30ma_d_t_rior | Différentiel 30mA Détérioré/ |
| py9cc56 | differentiel_30ma_mal_positionn | Différentiel 30mA mal positionné/ |
| py9cc56 | pas_de_differentiel_30ma | Pas de différentiel 30mA/ |
| nm4md59 | conforme | Conforme |
| nm4md59 | non_conforme | Non conforme |
| nr8tv95 | absence_de_modulaire_lumiere | Absence de modulaire LUMIERE (C10/C16)/ |
| nr8tv95 | absence_de_modulaire_prise | Absence de modulaire PRISE( C10/C16/C20)/ |
| nr8tv95 | calibre_modulaire_non_adapt | Calibre modulaire non adapté/ |
| bm2rn03 | conforme | Conforme |
| bm2rn03 | non_conforme | Non conforme |
| ps4nb23 | boite_de_derivation_sans_couvercle | Boite de dérivation sans couvercle/ |
| ps4nb23 | coffret_trou | Coffret Disjoncteur troué/ |
| ps4nb23 | option_1 | PNST accessible sur Douille/ |
| ps4nb23 | option_2 | PNST accessible sur Prise/ |
| ps4nb23 | pnst_accessible_sur_c_ble | PNST accessible sur Câble/ |
| ps4nb23 | pnst_accessible_sur_interrupteur | PNST accessible sur Interrupteur/ |
| ps4nb23 | prise_sans_obturateur | Prise sans obturateur/ |
| jm8qy41 | absence_de_douille | Absence de Douille/ |
| jm8qy41 | absence_de_prise | Absence de Prise/ |
| jm8qy41 | boite_de_d_rivation_mal_fix_e | Boite de dérivation mal fixée/ |
| jm8qy41 | c_blage__lumi_re_interrupteur__mal_effec | Câblage (lumière/interrupteur) mal effectué/ |
| jm8qy41 | c_blage___refaire_c_blage_prise_mal_effe | Câblage Prise mal effectué/ |
| jm8qy41 | cable_1_5mm__jonctionn__par__pissure | Câble 1,5mm² Jonctionné par épissure/ |
| jm8qy41 | cable_2_5mm__jonctionn__par__pissure | Câble 2,5mm² Jonctionné par épissure/ |
| jm8qy41 | c_ble_arm__non_enterr | Câble d'alimentation mal enterré/ |
| jm8qy41 | cable_d_alimentation_non_adapt | Câble d'alimentation non adapté pour être enterré/ |
| jm8qy41 | cable_mal_fix | Câblage intérieur mal fixé sur parois/ |
| jm8qy41 | coffret_disjoncteur___d_placer_en_lieu_c | Coffret disjoncteur à déplacer en lieu couvert / |
| jm8qy41 | code_de_couleur__conducteur__non_respect | Code de couleur (conducteur) non respecté/ |
| jm8qy41 | coffret_disjoncteur_mal_fix | Coffret disjoncteur mal fixé/ |
| jm8qy41 | cable_d_alimentation_4mm__mal_fix | Câble d'alimentation 4mm² mal fixé sur parois/ |
| jm8qy41 | c_blage_pass__en_a_rien | Câblage passé en aérien et non enterré/ |
| jm8qy41 | d_faut_connexion_lumi_re | Défaut connexion lumière(mal câblé)/ |
| jm8qy41 | douille___remplacer | Douille à remplacer (détériorée)/ |
| jm8qy41 | douille_mal_fix | Douille mal fixé sur parois/ |
| jm8qy41 | d_faut_connexion_prise__mal_c_bl | Défaut connexion Prise (mal câblé)/ |
| jm8qy41 | interrupteur___d_placer_en_lieu_couvert_ | Interrupteur à déplacer en lieu couvert / |
| jm8qy41 | interrupteur___remplacer | Interrupteur à remplacer (détérioré)/ |
| jm8qy41 | interrupteur_mal_fix | Interrupteur mal fixé/ |
| jm8qy41 | prise___remplacer | Prise à remplacer(détériorée)/ |
| jm8qy41 | pas_de_boite_de_d_rivation | Pas de boite de dérivation/ |
| jm8qy41 | prise_mal_fix_e | Prise mal fixée sur parois/ |
| jm8qy41 | profondeur_tranch_e_non_ad_quate__minimu | Profondeur de la tranchée non adéquate (minimum 30cm à creuser)/ |
| jm8qy41 | pas_de_domino_au_niveau_de_la_boite_de_d | Pas de dominos au niveau de la boite de dérivation/ |
| jm8qy41 | section_2_5mm__non_adapt_e_pour_les_lamp | Section câble 2,5mm² non adaptée pour les lampes/ |
| jm8qy41 | section_cable_d_alimentation_non_respect | Section Cable d'alimentation non respectée (minimum 4mm²)/ |
| vo5kj15 | conducteurs_visibles_sur_c_ble_1_5mm | Conducteurs visibles sur câble 1,5mm²/ |
| vo5kj15 | conducteurs_visibles_sur_c_ble_2_5mm | Conducteurs visibles sur câble 2,5mm²/ |
| vo5kj15 | conducteurs_visibles_sur_c_ble_4mm | Conducteurs visibles sur câble 4mm²/ |
| vo5kj15 | conducteur_principal_de_protection_vert_ | Conducteur principal de protection Vert/Jaune sans gaine ou fourreau/ |
| pi0xx78 | absence_de_piquet_de_terre | Absence de piquet de terre/ |
| pi0xx78 | terre_non_raccord__sur_boite_de_d_rivati | Conducteur de protection (Terre) non raccordé au niveau de la boite de dérivation/ |
| pi0xx78 | terre_non_raccord__au_niveau_du_coffret | Conducteur de protection (Terre) non raccordé au niveau du coffret disjoncteur/ |
| pi0xx78 | d_placer_la_barrette_de_terre___l_endroi | Déplacer la barrette de terre à l'endroit indiqué/ |
| pi0xx78 | pas_de_barrette_de_terre | Pas de barrette de terre/ |
| pi0xx78 | pas_de_continuit__du_conducteur_de_prote | Pas de continuité du conducteur de protection (vert/jaune)/ |
| pi0xx78 | pas_de_domino_sur_circuit_de_terre__coff | Pas de domino sur circuit de terre (coffret)/ |
| pi0xx78 | pas_de_domino_sur_circuit_de_terre__boit | Pas de domino sur circuit de terre (Boite)/ |
| pi0xx78 | piquet_de_terre_d_connect | Piquet de terre déconnecté/ |
| pi0xx78 | pas_de_protection_m_canique_du_conducteu | Pas de protection mécanique du conducteur principale de protection (vert/jaune)/ |
| pi0xx78 | r_seau_de_terre_non_raccord | Réseau de terre non raccordé/ |
| pi0xx78 | r_seau_terre_en_cours_de_pose | Réseau de terre En cours de pose/ |
| lk4xz51 | barrette_conforme | Barrette conforme |
| lk4xz51 | barrette_rouill_e | Barrette Rouillée |
