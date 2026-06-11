<?php
defined('BASEPATH') OR exit('No direct script access allowed');

class Waha extends CI_Controller
{
	/** URL API wa_lazy, sesuaikan dengan server Anda */
	private $wa_api_url = 'http://localhost:3335/api/message';

	public function index(){
		header('Content-Type: application/json; charset=utf-8');

		$json = file_get_contents('php://input');
		$data = json_decode($json, true);

		// Skip pesan dari bot sendiri — ini penyebab balasan dobel (balasan bot ikut diproses)
		if (
			!empty($data['fromMe']) ||
			!empty($data['flags']['fromMe']) ||
			!empty($data['key']['fromMe'])
		) {
			echo json_encode(['status' => 'ok']);
			return;
		}

		// Hanya proses pesan teks
		if (empty($data['flags']['isText']) || empty($data['msg']['rawText'])) {
			echo json_encode(['status' => 'ok']);
			return;
		}

		// Cegah balasan dobel: webhook bisa terpanggil 2x (event WA duplikat / timeout retry)
		$msgId = $data['key']['id'] ?? null;
		if ($msgId && $this->isMessageProcessed($msgId)) {
			echo json_encode(['status' => 'ok', 'duplicate' => true]);
			return;
		}
		if ($msgId) {
			$this->markMessageProcessed($msgId);
		}

		// Balas HTTP 200 dulu agar wa_lazy tidak timeout (limit 5 detik) lalu proses di belakang
		echo json_encode(['status' => 'ok']);
		if (function_exists('fastcgi_finish_request')) {
			fastcgi_finish_request();
		}

		$token    = $data['token'];
		$chat     = $data['chat'];
		$device   = $data['bot']['session'] ?? '';
		$sender   = explode('@', $data['sender']['pn'] ?? $data['chat'])[0];
		$message  = strtolower($data['msg']['rawText'] ?? '');
		$member   = explode('@', $data['sender']['pn'] ?? '')[0]; //group member who send the message
		$name     = $data['sender']['pushName'] ?? '';
		$location = $data['location'] ?? '';
		//data below will only received by device with all feature package
		//start
		$url       = $data['url'] ?? '';
		$filename  = $data['filename'] ?? '';
		$extension = $data['extension'] ?? '';
		//end


		function sendWaLazy($token, $to, $message, $apiUrl) {
			$curl = curl_init();

			curl_setopt_array($curl, array(
			  CURLOPT_URL => $apiUrl,
			  CURLOPT_RETURNTRANSFER => true,
			  CURLOPT_ENCODING => "",
			  CURLOPT_MAXREDIRS => 10,
			  CURLOPT_TIMEOUT => 0,
			  CURLOPT_FOLLOWLOCATION => true,
			  CURLOPT_HTTP_VERSION => CURL_HTTP_VERSION_1_1,
			  CURLOPT_CUSTOMREQUEST => "POST",
			  CURLOPT_POSTFIELDS => json_encode(array(
					'token'   => $token,
					'to'      => $to,
					'message' => $message,
				)),
			  CURLOPT_HTTPHEADER => array(
				'Content-Type: application/json'
			  ),
			));

			$response = curl_exec($curl);

			curl_close($curl);

			return $response;
		}


		//MULAI DARI SINI

		$no_hp0		=	substr_replace((int)$sender,'0',0,2);
		$no_hp62	=	(int)$sender;

		$cek_db			=	$this->db->get_where('tb_produk', array('kodeItem' => $message));
		$cek_db2		=	$this->db->get_where('tb_produk', array('kodeItem' => $message));
		//$cek_db2		=	$this->db->get_where('tb_produk', array('kodeitem_new' => $message));
		$cek_db3		=	$this->db->get_where('tb_produk', array('barcode' => $message)); //VIA BARCODE


		$cek_no_admin	=	$this->db->where('NoTelpon', $no_hp0)->or_where('NoTelpon', $no_hp62)->get('sys_user');
		$cek_no_supp	=	$this->db->where('hp', $no_hp0)->or_where('hp', $no_hp62)->get('tb_user');

		//CEK NOMOR
		if($cek_no_admin->num_rows() > 0 || $cek_no_supp->num_rows() > 0){
			if($cek_no_supp->row()->wabot == 1){
			$orderan	=	substr($message, 0, 5);
			if($orderan == 'order'){
				$datane	=	explode(PHP_EOL, $message);


				//PARAM1 => MESSAGE, PARAM2 => NO HP, PARAM3 => IDPEMBELI
				$param1	=	$datane;
				$param2	=	$no_hp62;
				$param3	=	$cek_no_supp->row()->iduser;

				$this->load->model('Penjualan_model', 'penjualan');
				//CEK PART
				$no			=	1;
				$count		=	0;
				$countpart	=	0;
				$countformat=	0;
				foreach($param1 as $row2){
					if($no > 1){
						//SPLIT KODE PART DAN QTY
						$detail	=	explode('/', $row2);
						//$detail[0]	=	KODEPART
						//$detail[1]	=	QTY

						//CEK PART
						$cek_part	=	$this->db->get_where('tb_produk', array('kodeItem' => $detail[0]));
						if($cek_part->num_rows() > 0){
							if($cek_part->row()->Stok >= $detail[1]){
								//STOK >= PESANAN
								$ct	=	0;
							}else{
								//STOK KURANG
								$ct	=	1;
							}
							$cp	=	0;
						}else{
							$cp	=	1;
							$ct	=	1;
						}
						if(count($detail) != 2){
							$cf		=	1;
						}else{
							$cf		=	0;
						}

						$countformat+=	$cf;
						$countpart	+=	$cp;
						$count		+=	$ct;

					}
					$no++;
				}
				if(count($param1) <= 1){
					$reply = [
						"message" => 'Item Order Tidak Terdeteksi Pada Sistem Kami, Silakan Coba Kembali.'
						. PHP_EOL . ''
						. PHP_EOL . 'Contoh'
						. PHP_EOL . ''
						. PHP_EOL . '*ORDER*'
						. PHP_EOL . '*ITEM-PART-1/QTY-ORDER*'
						. PHP_EOL . '*ITEM-PART-2/QTY-ORDER*'
						. PHP_EOL . '*ITEM-PART-3/QTY-ORDER*'
					];
				}else if($countformat > 0){
					$reply = [
						"message" => 'Format Item Order Tidak Sesuai'
						. PHP_EOL . ''
						. PHP_EOL . 'Contoh'
						. PHP_EOL . ''
						. PHP_EOL . '*ORDER*'
						. PHP_EOL . '*ITEM-PART-1/QTY-ORDER*'
						. PHP_EOL . '*ITEM-PART-2/QTY-ORDER*'
						. PHP_EOL . '*ITEM-PART-3/QTY-ORDER*'
					];
				}else if($countpart > 0){

//UNTUK KIRIM WA
$psn1	=	'*SALES INFORMATION SYSTEM*

Failed Order. Unknown Part Number!

';

$no1	=	1;
foreach($param1 as $row1){

if($no1 > 1){
$dtl1		=	explode('/', $row1);
$kode_item1	=	$dtl1[0];
$qty1		=	$dtl1[1];
$cek_part1	=	$this->db->get_where('tb_produk', array('kodeItem' => $dtl1[0]));
$cek_part2	=	$this->db->get_where('tb_produk', array('kodeItem' => $dtl1[0]));
//$cek_part2	=	$this->db->get_where('tb_produk', array('kodeitem_new' => $dtl1[0]));
if($cek_part1->num_rows() > 0 || $cek_part2->num_rows() > 0){
	$ok	=	'*(V)*';
}else{
	$ok	=	'*(X)*';
}

$psn1 .= $kode_item1 ." ".$ok.'
';
}
$no1++;
}

$psn1 .= '

Terima kasih,
*Infinity In Your Hands*';
//END

					$reply = [
						"message" => $psn1
					];
				}else if($count == 0){

					//ID PEMBELI
					$id_pembeli	=	$param3;
					$no_order	=	$this->konter();
					//MULAI TRANSAKSI

					//DATA CUSTOMER
					$Cust =   $this->db->select('a.id, f.top, f.iduser, f.nama, f.notelp, f.npwp, b.nama_prov, c.nama_kabkot, d.nama_kec, a.kelurahan, a.alamat, a.kodepos')
									->join('tb_user f', 'f.iduser = a.id_user', 'LEFT')
										->join('prov b', 'b.id_prov = a.prov', 'LEFT')
											->join('kabkot c', 'c.id_kabkot = a.kabkot', 'LEFT')
												->join('kec d', 'd.id_kec = a.kec', 'LEFT')
													->where('a.isaktif', 1)
														->where('f.iduser', $id_pembeli)
															->limit(1)
									->get('tb_useralamat a');


					$dtCust =   $Cust->row_array();
					//END DATA CUSTOMER

					//ORDER DETAIL
					$noe		=	1;
					//$count2		=	0;
					$dsc_prc	=	0;
					$dsc_rp		=	0;
					$total		=	0;
					$total_jns	=	0;
					$total_prd	=	0;


					foreach($param1 as $row){
						if($noe > 1){
							//SPLIT KODE PART DAN QTY
							$detail	=	explode('/', $row);
							//$detail[0]	=	KODEPART
							//$detail[1]	=	QTY

							$kode_item	=	$detail[0];
							$qty		=	$detail[1];

							//CEK PART
							$cek_part	=	$this->db->get_where('tb_produk', array('kodeItem' => $kode_item));
							$cek_part2	=	$this->db->get_where('tb_produk', array('kodeItem' => $kode_item));
							//$cek_part2	=	$this->db->get_where('tb_produk', array('kodeitem_new' => $kode_item));
							if($cek_part->num_rows() > 0){
								$part	=	$cek_part->row_array();

								$datas['noorder']    	=   $no_order;
								$datas["kodeitem"]		=	$part['kodeItem'];
								$datas["namabarang"]	=	$part['namabarang'];
								$datas['qtypesan']   	=   $qty;
								$datas["hargajual"]		=	$part['HargaJual'];
								if($part['dscSupp'] == null || $part['dscSupp'] == ''){
									$datas["dscSupplier"]=	0;
								}else{
									$datas["dscSupplier"]=	$part['dscSupp'];
								}
								$datas['dsc_brg_persen']=   $part['_dscMin'];
								$datas['hargaAkhir']	=   $part['HargaAkhir'];
								$datas['dscBrg']     	=   (($part['HargaJual'] * $part['_dscMin'] / 100) * $qty);
								$datas['dscSales']   	=   0;
								$datas['nama_mobil'] 	=   $part['nama_mobil'];
								$datas['substitusi'] 	=   $part['substitusi'];
								$datas['total'] 		=   (($datas["hargajual"] * $datas['qtypesan']) - $datas['dscBrg']);


								$this->db->insert('tb_orderdtl', $datas);

								$cek_again		=	$this->db->get_where('tb_produk', array('kodeItem' => $datas["kodeitem"]))->row()->Stok;
								$save_qty_again	=	($cek_again - $datas['qtypesan']);


								//SIMPAN HISTORY
								$datahs['invoice']			=	$no_order;
								$datahs['kodeItem']			=	$datas["kodeitem"];
								$datahs['typeTrn']			=	'A';
								$datahs['jenis_transaksi']	=	2;
								$datahs['stok_awal']		=	$cek_again;
								$datahs['stok_akhir']		=	$save_qty_again;
								$datahs['jumlah_keluar']	=	$qty;
								$datahs['jumlah_masuk']		=	0;
								$datahs['keterangan']		=	'Penjualan Produk '.$datas['kodeitem'].' An. '.$dtCust['nama'];
								$datahs['created_at']		=	date('Y-m-d H:i:s');
								$datahs['user_id']			=	99999;

								$this->db->insert('tb_history_stok', $datahs);

								$this->db->update('tb_produk', array('Stok' => $save_qty_again), array('kodeItem' => $datas["kodeitem"]));

								//PROSES DAN UPDATE KONTER
								//TB PROSES
								$dbprs['proses_id']		=	0;
								$dbprs['noOrder']		=	$no_order;
								$dbprs['created_at']	=	date('Y-m-d H:i:s');
								$dbprs['user_id']		=	99999;
								$this->db->insert('tb_proses', $dbprs);


								//$ct2	=	0;
								$prd	=	1;
							}else if($cek_part2->num_rows() > 0){
								$part	=	$cek_part2->row_array();

								$datas['noorder']    	=   $no_order;
								$datas["kodeitem"]		=	$part['kodeItem'];
								$datas["namabarang"]	=	$part['namabarang'];
								$datas['qtypesan']   	=   $qty;
								$datas["hargajual"]		=	$part['HargaJual'];
								if($part['dscSupp'] == null || $part['dscSupp'] == ''){
									$datas["dscSupplier"]=	0;
								}else{
									$datas["dscSupplier"]=	$part['dscSupp'];
								}
								$datas['dsc_brg_persen']=   $part['_dscMin'];
								$datas['hargaAkhir']	=   $part['HargaAkhir'];
								$datas['dscBrg']     	=   (($part['HargaJual'] * $part['_dscMin'] / 100) * $qty);
								$datas['dscSales']   	=   0;
								$datas['nama_mobil'] 	=   $part['nama_mobil'];
								$datas['substitusi'] 	=   $part['substitusi'];
								$datas['total'] 		=   (($datas["hargajual"] * $datas['qtypesan']) - $datas['dscBrg']);


								$this->db->insert('tb_orderdtl', $datas);

								$cek_again		=	$this->db->get_where('tb_produk', array('kodeItem' => $datas["kodeitem"]))->row()->Stok;
								$save_qty_again	=	($cek_again - $datas['qtypesan']);


								//SIMPAN HISTORY
								$datahs['invoice']			=	$no_order;
								$datahs['kodeItem']			=	$datas["kodeitem"];
								$datahs['typeTrn']			=	'A';
								$datahs['jenis_transaksi']	=	2;
								$datahs['stok_awal']		=	$cek_again;
								$datahs['stok_akhir']		=	$save_qty_again;
								$datahs['jumlah_keluar']	=	$qty;
								$datahs['jumlah_masuk']		=	0;
								$datahs['keterangan']		=	'Penjualan Produk '.$datas['kodeitem'].' An. '.$dtCust['nama'];
								$datahs['created_at']		=	date('Y-m-d H:i:s');
								$datahs['user_id']			=	99999;

								$this->db->insert('tb_history_stok', $datahs);

								$this->db->update('tb_produk', array('Stok' => $save_qty_again), array('kodeItem' => $datas["kodeitem"]));

								//PROSES DAN UPDATE KONTER
								//TB PROSES
								$dbprs['proses_id']		=	0;
								$dbprs['noOrder']		=	$no_order;
								$dbprs['created_at']	=	date('Y-m-d H:i:s');
								$dbprs['user_id']		=	99999;
								$this->db->insert('tb_proses', $dbprs);


								//$ct2	=	0;
								$prd	=	1;
							}else{
								//$ct2						=	1;
								$prd						=	0;
								$datas['dsc_brg_persen']	=	0;
								$datas['dscBrg']			=	0;
								$datas['total']				=	0;
							}

							$dsc_prc	+=	$datas['dsc_brg_persen'];
							$dsc_rp		+=	$datas['dscBrg'];
							$total		+=	$datas['total'];
							$total_jns	+=	$datas['qtypesan'];
							$total_prd	+=	$prd;
						}
						$noe++;
					}


				//INPUT KE ORDER
				$dataprc['noOrder']         =   $no_order;
				$dataprc['TglTransaksi']    =   date('Y-m-d');
				$dataprc['TglJatuhTempo']   =   date('Y-m-d', strtotime('+'.$dtCust['top'].' days', strtotime($dataprc['TglTransaksi'])));
				$dataprc['idpembeli']       =   $id_pembeli;
				$dataprc['isCash']       	=   0;
				$dataprc['nama']            =   $dtCust['nama'];
				$dataprc['prop']            =   $dtCust['nama_prov'];
				$dataprc['kota']            =   $dtCust['nama_kabkot'];
				$dataprc['kecamatan']       =   $dtCust['nama_kec'];
				$dataprc['kelurahan']       =   $dtCust['kelurahan'];
				$dataprc['alamat']          =   $dtCust['alamat'];
				$dataprc['kodepos']         =   $dtCust['kodepos'];
				$dataprc['npwp']            =   $dtCust['npwp'];
				$dataprc['tglEntry']        =   date('Y-m-d H:i:s');
				$dataprc['total']           =  	$total;
				$dataprc['diskonpersen']    =   $dsc_prc;
				$dataprc['diskonrp']        =   $dsc_rp;
				$dataprc['saldo']           =   0;
				$dataprc['tagihan']         =   0;
				$dataprc['ketOrder']        =   '';
				$dataprc['proses']        	=   0;
				$dataprc['wa']        		=   1;

				$dataprc['qty_produk']    	=   $total_prd;
				$dataprc['qty_jenis']     	=   $total_jns;

				$dataprc['nobuktitransfer'] =   'wa';
				$dataprc['namalain']        =   'Order Via WA';
				$dataprc['ongkir']          =   0;
				$dataprc['service_charge']	=   100;
				$dataprc['grandtotal']      =  	$dataprc['total'] + $dataprc['service_charge'] + $dataprc['ongkir'];
				$dataprc['user_id']       	=   99999;
				$dataprc['user_created']  	=   99999;
				$dataprc['updated_at']    	=   date('Y-m-d H:i:s');
				$this->db->insert('tb_order', $dataprc);

				$this->db->query('update tb_konter set nomor = nomor + 1 where transaksi in ("order")');



				$datamu['konten']    	= $message;
				$datamu['user_id']    	= $param2;
				$datamu['created_at'] 	= date('Y-m-d H:i:s');

				$this->db->insert('tb_order_wa', $datamu);

//UNTUK KIRIM WA
$pesan	=	'*SALES INFORMATION SYSTEM*

Hai *'.$dataprc['nama'].'*

Pesanan Anda telah di *PROSES*, *INVOICE '.$no_order.'*

*RINCIAN PESANAN*
';

$nomer	=	1;

foreach($param1 as $rowsdsa){

if($nomer > 1){
$detail	=	explode('/', $rowsdsa);
$kode_item	=	$detail[0];
$qty		=	$detail[1];
$ceks_part	=	$this->db->get_where('tb_produk', array('kodeItem' => $kode_item));
$ceks_part2	=	$this->db->get_where('tb_produk', array('kodeItem' => $kode_item));
//$ceks_part2	=	$this->db->get_where('tb_produk', array('kodeitem_new' => $kode_item));
if($ceks_part->num_rows() > 0){
	$cek_part	=	$ceks_part->row_array();
}else{
	$cek_part	=	$ceks_part2->row_array();
}

$pesan .= "(".$qty.") # ".$kode_item ."   ". $cek_part['namabarang'].'
';
}
$nomer++;
}

$pesan .= '


Terima kasih,
*Infinity In Your Hands*';

					$reply = [
						"message" => $pesan
					];
//END


				}else{
//UNTUK KIRIM WA
$psn1	=	'*SALES INFORMATION SYSTEM*

Failed Order. Available Here

';

$no1	=	1;
foreach($param1 as $row1){

if($no1 > 1){
$dtl1		=	explode('/', $row1);
$kode_item1	=	$dtl1[0];
$qty1		=	$dtl1[1];
$cek_part1	=	$this->db->get_where('tb_produk', array('kodeItem' => $dtl1[0]));

$psn1 .= $kode_item1 ."/".$cek_part1->row()->Stok.'
';
}
$no1++;
}

$psn1 .= '

Terima kasih,
*Infinity In Your Hands*';
//END
					$reply = [
						"message" => $psn1
					];
				}
			}
			else if ($cek_db->num_rows() == 1) {
				if($cek_db->row()->Stok > 0){
					$stok	=	'AVAILABLE';
					//$diskon =   number_format($cek_db->row()->_dscMax);
					$diskon =   number_format($cek_db->row()->_dscMin);
				}else{
					$stok	=	'NOT AVAILABLE';
					$diskon =   0;
				}

				if($cek_db->row()->Foto != ''){
					$reply = [
						"message" => '*INFINITY CORPORA*'
										. PHP_EOL . ''. PHP_EOL . 'Part Number : *'
										. $cek_db->row()->kodeItem .'*'
										. PHP_EOL . 'Part Name : *' .$cek_db->row()->namabarang. '*'
										. PHP_EOL . 'Substitution : *' .$cek_db->row()->substitusi. '*'
										. PHP_EOL . 'Price List : *Rp. '
										.number_format($cek_db->row()->HargaJual,0,',','.'). '*'
										. PHP_EOL . 'Discount : *' .$diskon. '%*'
										. PHP_EOL . 'Stock : *' .$stok. '*'
										. PHP_EOL . '' . PHP_EOL . '*Syarat dan Ketentuan Berlaku.'
										. PHP_EOL . '' . PHP_EOL . 'Pemesanan produk hubungi Part Consultant Kami.'
										. PHP_EOL . 'Amin +6285869837971'
										. PHP_EOL . 'Della +62816779174'
										. PHP_EOL . 'Terima kasih dan selamat berbelanja.',
					];
				}else{
					$reply = [
						"message" => '*INFINITY CORPORA*'
										. PHP_EOL . ''. PHP_EOL . 'Part Number : *'
										. $cek_db->row()->kodeItem .'*'
										. PHP_EOL . 'Part Name : *' .$cek_db->row()->namabarang. '*'
										. PHP_EOL . 'Substitution : *' .$cek_db->row()->substitusi. '*'
										. PHP_EOL . 'Price List : *Rp. '
										.number_format($cek_db->row()->HargaJual,0,',','.'). '*' . PHP_EOL
										. 'Discount : *' .$diskon. '%*'
										. PHP_EOL . 'Stock : *' .$stok. '*'
										. PHP_EOL . '' . PHP_EOL . '*Syarat dan Ketentuan Berlaku.'
										. PHP_EOL . '' . PHP_EOL . 'Pemesanan produk hubungi Part Consultant kami.'
										. PHP_EOL . 'Amin +6285869837971'
										. PHP_EOL . 'Della +62816779174'
										. PHP_EOL . 'Terima kasih dan selamat berbelanja.'
					];
				}
                $this->insert($cek_db->row()->kodeItem, $no_hp62);
			}
			else if ($cek_db2->num_rows() == 1) {
				if($cek_db2->row()->Stok > 0){
					$stok	=	'AVAILABLE';
					//$diskon =   number_format($cek_db->row()->_dscMax);
					$diskon =   number_format($cek_db2->row()->_dscMin);
				}else{
					$stok	=	'NOT AVAILABLE';
					$diskon =   0;
				}

				if($cek_db2->row()->Foto != ''){
					$reply = [
						"message" => '*INFINITY CORPORA*'
										. PHP_EOL . ''. PHP_EOL . 'Part Number : *'
										//. $cek_db2->row()->kodeitem_new .'*'
										. $cek_db2->row()->kodeItem .'*'
										. PHP_EOL . 'Part Name : *' .$cek_db2->row()->namabarang. '*'
										. PHP_EOL . 'Substitution : *' .$cek_db2->row()->substitusi. '*'
										. PHP_EOL . 'Price List : *Rp. '
										.number_format($cek_db2->row()->HargaJual,0,',','.'). '*' . PHP_EOL
										. 'Discount : *' .$diskon. '%*'
										. PHP_EOL . 'Stock : *' .$stok. '*'
										. PHP_EOL . '' . PHP_EOL . '*Syarat dan Ketentuan Berlaku.'
										. PHP_EOL . '' . PHP_EOL . 'Pemesanan produk hubungi Part Consultant Kami.'
										. PHP_EOL . 'Amin +6285869837971'
										. PHP_EOL . 'Della +62816779174'
										. PHP_EOL . 'Terima kasih dan selamat berbelanja.',
					];
				}else{
					$reply = [
						"message" => '*INFINITY CORPORA*'
									. PHP_EOL . ''. PHP_EOL . 'Part Number : *'
									//. $cek_db2->row()->kodeitem_new .'*'
									. $cek_db2->row()->kodeItem .'*'
									. PHP_EOL . 'Part Name : *' .$cek_db2->row()->namabarang. '*'
									. PHP_EOL . 'Substitution : *' .$cek_db2->row()->substitusi. '*'
									. PHP_EOL . 'Price List : *Rp. '
									.number_format($cek_db2->row()->HargaJual,0,',','.'). '*' . PHP_EOL
									. 'Discount : *' .$diskon. '%*'
									. PHP_EOL . 'Stock : *' .$stok. '*'
									. PHP_EOL . '' . PHP_EOL . '*Syarat dan Ketentuan Berlaku.'
									. PHP_EOL . '' . PHP_EOL . 'Pemesanan produk hubungi Part Consultant kami.'
									. PHP_EOL . 'Amin +6285869837971'
									. PHP_EOL . 'Della +62816779174'
									. PHP_EOL . 'Terima kasih dan selamat berbelanja.'
					];
				}
                $this->insert($cek_db2->row()->kodeItem, $no_hp62);
                //$this->insert($cek_db2->row()->kodeitem_new, $no_hp62);
			}
			else if ($cek_db3->num_rows() == 1) {
				if($cek_db3->row()->Stok > 0){
					$stok	=	'AVAILABLE';
					//$diskon =   number_format($cek_db->row()->_dscMax);
					$diskon =   number_format($cek_db3->row()->_dscMin);
				}else{
					$stok	=	'NOT AVAILABLE';
					$diskon =   0;
				}

				if($cek_db3->row()->Foto != ''){
					$reply = [
						"message" => '*INFINITY CORPORA*'
										. PHP_EOL . ''. PHP_EOL . 'Part Number : *'
										. $cek_db3->row()->barcode .' Via BARCODE*'
										. PHP_EOL . 'Part Name : *' .$cek_db3->row()->namabarang. '*'
										. PHP_EOL . 'Substitution : *' .$cek_db3->row()->substitusi. '*'
										. PHP_EOL . 'Price List : *Rp. '
										.number_format($cek_db3->row()->HargaJual,0,',','.'). '*' . PHP_EOL
										. 'Discount : *' .$diskon. '%*'
										. PHP_EOL . 'Stock : *' .$stok. '*'
										. PHP_EOL . '' . PHP_EOL . '*Syarat dan Ketentuan Berlaku.'
										. PHP_EOL . '' . PHP_EOL . 'Pemesanan produk hubungi Part Consultant Kami.'
										. PHP_EOL . 'Amin +6285869837971'
										. PHP_EOL . 'Della +62816779174'
										. PHP_EOL . 'Terima kasih dan selamat berbelanja.',
					];
				}else{
					$reply = [
						"message" => '*INFINITY CORPORA*'
									. PHP_EOL . ''. PHP_EOL . 'Part Number : *'
									. $cek_db3->row()->barcode .' Via BARCODE*'
									. PHP_EOL . 'Part Name : *' .$cek_db3->row()->namabarang. '*'
									. PHP_EOL . 'Substitution : *' .$cek_db3->row()->substitusi. '*'
									. PHP_EOL . 'Price List : *Rp. '
									.number_format($cek_db3->row()->HargaJual,0,',','.'). '*' . PHP_EOL
									. 'Discount : *' .$diskon. '%*'
									. PHP_EOL . 'Stock : *' .$stok. '*'
									. PHP_EOL . '' . PHP_EOL . '*Syarat dan Ketentuan Berlaku.'
									. PHP_EOL . '' . PHP_EOL . 'Pemesanan produk hubungi Part Consultant kami.'
									. PHP_EOL . 'Amin +6285869837971'
									. PHP_EOL . 'Della +62816779174'
									. PHP_EOL . 'Terima kasih dan selamat berbelanja.'
					];
				}
                $this->insert($cek_db3->row()->barcode, $no_hp62);
			}else{
				$reply = [
					"message" => '*SALES INFORMATION SYSTEM*'
					            . PHP_EOL . '' . PHP_EOL . 'Maaf pesan kamu tidak dikenali sistem kami, ketikkan *Number Part* dengan benar.'
					            . PHP_EOL . '' . PHP_EOL . 'Pusat bantuan hubungi Part Consultant kami.'
								. PHP_EOL . 'Amin +6285869837971'
								. PHP_EOL . 'Della +62816779174'
								. PHP_EOL . 'Terima kasih dan selamat berbelanja.'
				];
			}
			}else{
				$reply = [
					"message" => '*SALES INFORMATION SYSTEM*'
					            . PHP_EOL . '' . PHP_EOL . 'Maaf nomor kamu *TERBLOKIR*.'
					            . PHP_EOL . '' . PHP_EOL . 'Silahkan hubungi Part Consultant kami.'
								. PHP_EOL . 'Amin +6285869837971'
								. PHP_EOL . 'Della +62816779174'
								. PHP_EOL . 'Terima kasih dan selamat berbelanja.'
				];
			}
		}else{
			$reply = [
				"message" => '*SALES INFORMATION SYSTEM*'
			            . PHP_EOL . '' . PHP_EOL . 'Maaf nomor kamu *TIDAK TERDAFTAR*.'
			            . PHP_EOL . '' . PHP_EOL . 'Silahkan hubungi Part Consultant kami.'
						. PHP_EOL . 'Amin +6285869837971'
						. PHP_EOL . 'Della +62816779174'
						. PHP_EOL . 'Terima kasih dan selamat berbelanja.'
			];
		}


		if (isset($reply)) {
			sendWaLazy($token, $chat, $reply['message'], $this->wa_api_url);
		}
	}




	private function processedMessageFile() {
		$dir = APPPATH . 'cache';
		if (!is_dir($dir)) {
			@mkdir($dir, 0755, true);
		}
		return $dir . '/wa_processed_messages.json';
	}

	private function isMessageProcessed($msgId) {
		$file = $this->processedMessageFile();
		if (!file_exists($file)) {
			return false;
		}
		$processed = json_decode(file_get_contents($file), true) ?: [];
		return isset($processed[$msgId]);
	}

	private function markMessageProcessed($msgId) {
		$file = $this->processedMessageFile();
		$processed = file_exists($file) ? (json_decode(file_get_contents($file), true) ?: []) : [];
		$processed[$msgId] = time();
		// Hapus entri lebih dari 1 jam agar file tidak membengkak
		foreach ($processed as $id => $ts) {
			if (time() - $ts > 3600) {
				unset($processed[$id]);
			}
		}
		file_put_contents($file, json_encode($processed), LOCK_EX);
	}

	function no_hp($nohp) {
		// kadang ada penulisan no hp 0811 239 345
		$nohp = str_replace(" ","",$nohp);
		// kadang ada penulisan no hp (0274) 778787
		$nohp = str_replace("(","",$nohp);
		// kadang ada penulisan no hp (0274) 778787
		$nohp = str_replace(")","",$nohp);
		// kadang ada penulisan no hp 0811.239.345
		$nohp = str_replace(".","",$nohp);

		// cek apakah no hp mengandung karakter + dan 0-9
		if(!preg_match('/[^+0-9]/',trim($nohp))){
			// cek apakah no hp karakter 1-3 adalah +62
			if(substr(trim($nohp), 0, 3)=='62'){
				$hp = trim($nohp);
			}
			// cek apakah no hp karakter 1 adalah 0
			elseif(substr(trim($nohp), 0, 1)=='0'){
				$hp = '62'.substr(trim($nohp), 1);
			}
		}
		print $hp;
	}

    public function insert($param1, $param2){
        $data['keyword']    = $param1;
        $data['via']        = 'WA';
        $data['user_id']    = $param2;
        $data['created_at'] = date('Y-m-d H:i:s');

        $this->db->insert('t_search', $data);
    }


    public function order($param1, $param2){
        $data['konten']    = $param1;
        $data['user_id']    = $param2;
        $data['created_at'] = date('Y-m-d H:i:s');

        $this->db->insert('tb_order_wa', $data);
    }

	//INSERT DATA KE TABEL ORDER
	public function tb_order_wa($param1, $param2, $param3){
        $this->load->model('Penjualan_model', 'penjualan');
		//PARAM1 => MESSAGE, PARAM2 => NO HP, PARAM3 => IDPEMBELI
		$orderan	=	explode(PHP_EOL, $param1);
		//CEK PART
		$no	=	1;
		$count	=	0;
		foreach($orderan as $row2){
			if($no > 1){
				//SPLIT KODE PART DAN QTY
				$detail	=	explode('/', $row2);
				//$detail[0]	=	KODEPART
				//$detail[1]	=	QTY

				//CEK PART
				$cek_part	=	$this->db->get_where('tb_produk', array('kodeItem' => $detail[0]));
				if($cek_part->num_rows() > 0){
					if($cek_part->row()->Stok >= $detail[1]){
						//STOK >= PESANAN
						$ct	=	0;
					}else{
						//STOK KURANG
						$ct	=	1;
					}
				}else{
					$ct	=	1;
				}
				$count		+=	$ct;
			}
			$no++;
		}
        //$data['konten']    	= $count;
        //$data['user_id']    = $param2;
        //$data['created_at'] = date('Y-m-d H:i:s');

        //$this->db->insert('tb_order_wa', $data);
		if($count == 0 && count($orderan) > 1){

			//ID PEMBELI
			$id_pembeli	=	$param3;
			$no_order	=	$this->konter();
			//MULAI TRANSAKSI

			//DATA CUSTOMER
			$Cust =   $this->db->select('a.id, f.top, f.iduser, f.nama, f.notelp, f.npwp, b.nama_prov, c.nama_kabkot, d.nama_kec, a.kelurahan, a.alamat, a.kodepos')
							->join('tb_user f', 'f.iduser = a.id_user')
								->join('prov b', 'b.id_prov = a.prov')
									->join('kabkot c', 'c.id_kabkot = a.kabkot')
										->join('kec d', 'd.id_kec = a.kec')
											->where('a.isaktif', 1)
												->where('f.iduser', $id_pembeli)
													->limit(1)
							->get('tb_useralamat a');

			$dtCust =   $Cust->row_array();
			//END DATA CUSTOMER

				//ORDER DETAIL
				$noe		=	1;
				//$count2		=	0;
				$dsc_prc	=	0;
				$dsc_rp		=	0;
				$total		=	0;
				$total_jns	=	0;
				$total_prd	=	0;
				foreach($orderan as $row){
					if($noe > 1){
						//SPLIT KODE PART DAN QTY
						$detail	=	explode('/', $row);
						//$detail[0]	=	KODEPART
						//$detail[1]	=	QTY

						$kode_item	=	$detail[0];
						$qty		=	$detail[1];

						//CEK PART
						$cek_part	=	$this->db->get_where('tb_produk', array('kodeItem' => $kode_item));
						if($cek_part->num_rows() > 0){
							$part	=	$cek_part->row_array();

							$datas['noorder']    	=   $no_order;
							$datas["kodeitem"]		=	$part['kodeItem'];
							$datas["namabarang"]	=	$part['namabarang'];
							$datas['qtypesan']   	=   $qty;
							$datas["hargajual"]		=	$part['HargaJual'];
							$datas["dscSupplier"]	=	$part['dscSupp'];
							$datas['dsc_brg_persen']=   $part['_dscMin'];
							$datas['hargaAkhir']	=   $part['HargaAkhir'];
							$datas['dscBrg']     	=   (($part['HargaJual'] * $part['_dscMin'] / 100) * $qty);
							$datas['dscSales']   	=   0;
							$datas['nama_mobil'] 	=   $part['nama_mobil'];
							$datas['substitusi'] 	=   $part['substitusi'];
							$datas['total'] 		=   (($datas["hargajual"] * $datas['qtypesan']) - $datas['dscBrg']);

							$this->db->insert('tb_orderdtl', $datas);

							$cek_again		=	$this->db->get_where('tb_produk', array('kodeItem' => $datas["kodeitem"]))->row()->Stok;
							$save_qty_again	=	($cek_again - $datas['qtypesan']);

							//SIMPAN HISTORY
							$datahs['invoice']			=	$no_order;
							$datahs['kodeItem']			=	$datas["kodeitem"];
							$datahs['typeTrn']			=	'A';
							$datahs['jenis_transaksi']	=	2;
							$datahs['stok_awal']		=	$cek_again;
							$datahs['stok_akhir']		=	$save_qty_again;
							$datahs['jumlah_keluar']	=	$qty;
							$datahs['jumlah_masuk']		=	0;
							$datahs['keterangan']		=	'Penjualan Produk '.$rows['kodeItem'].' An. '.$dtCust['nama'];
							$datahs['created_at']		=	date('Y-m-d H:i:s');
							$datahs['user_id']			=	99999;

							$this->db->insert('tb_history_stok', $datahs);

							$this->db->update('tb_produk', array('Stok' => $save_qty_again), array('kodeItem' => $datas["kodeitem"]));

							//PROSES DAN UPDATE KONTER
							//TB PROSES
							$dbprs['proses_id']		=	0;
							$dbprs['noOrder']		=	$no_order;
							$dbprs['created_at']	=	date('Y-m-d H:i:s');
							$dbprs['user_id']		=	99999;
							$this->db->insert('tb_proses', $dbprs);


							//$ct2	=	0;
							$prd	=	1;
						}else{
							//$ct2						=	1;
							$prd						=	0;
							$datas['dsc_brg_persen']	=	0;
							$datas['dscBrg']			=	0;
							$datas['total']				=	0;
						}

						$dsc_prc	+=	$datas['dsc_brg_persen'];
						$dsc_rp		+=	$datas['dscBrg'];
						$total		+=	$datas['total'];
						$total_jns	+=	$datas['qtypesan'];
						$total_prd	+=	$prd;

						//$count2		+=	$ct2;
					}
					$noe++;
				}


				//INPUT KE ORDER
				$dataprc['noOrder']         =   $no_order;
				$dataprc['TglTransaksi']    =   date('Y-m-d');
				$dataprc['TglJatuhTempo']   =   date('Y-m-d', strtotime('+'.$dtCust['top'].' days', strtotime($dataprc['TglTransaksi'])));
				$dataprc['idpembeli']       =   $id_pembeli;
				$dataprc['isCash']       	=   0;
				$dataprc['nama']            =   $dtCust['nama'];
				$dataprc['prop']            =   $dtCust['nama_prov'];
				$dataprc['kota']            =   $dtCust['nama_kabkot'];
				$dataprc['kecamatan']       =   $dtCust['nama_kec'];
				$dataprc['kelurahan']       =   $dtCust['kelurahan'];
				$dataprc['alamat']          =   $dtCust['alamat'];
				$dataprc['kodepos']         =   $dtCust['kodepos'];
				$dataprc['npwp']            =   $dtCust['npwp'];
				$dataprc['tglEntry']        =   date('Y-m-d H:i:s');
				$dataprc['total']           =  	$total;
				$dataprc['diskonpersen']    =   $dsc_prc;
				$dataprc['diskonrp']        =   $dsc_rp;
				$dataprc['saldo']           =   0;
				$dataprc['tagihan']         =   0;
				$dataprc['ketOrder']        =   '';
				$dataprc['proses']        	=   0;

				$dataprc['qty_produk']    	=   $total_prd;
				$dataprc['qty_jenis']     	=   $total_jns;

				$dataprc['nobuktitransfer'] =   'wa';
				$dataprc['namalain']        =   'Order Via WA';
				$dataprc['ongkir']          =   0;
				$dataprc['service_charge']	=   100;
				$dataprc['grandtotal']      =  	$dataprc['total'] + $dataprc['service_charge'] + $dataprc['ongkir'];
				$dataprc['user_id']       	=   99999;
				$dataprc['user_created']  	=   99999;
				$dataprc['updated_at']    	=   date('Y-m-d H:i:s');
				$this->db->insert('tb_order', $dataprc);

				$this->db->query('update tb_konter set nomor = nomor + 1 where transaksi in ("order")');

$pesan	=	'*SALES INFORMATION SYSTEM*

Hai *'.$dataprc['nama'].'*

Pesanan Anda telah di *PROSES*, *INVOICE '.$no_order.'*

*RINCIAN PESANAN*
';

$nomer	=	1;
foreach($orderan as $rowsdsa){
$detail	=	explode('/', $rowsdsa);
$kode_item	=	$detail[0];
$qty		=	$detail[1];
$cek_part	=	$this->db->get_where('tb_produk', array('kodeItem' => $kode_item))->row_array();

if($nomer > 1){
$pesan .= "(".$qty.") # ".$kode_item ."   ". $cek_part['namabarang'].'
';
}

$nomer++;
}

$pesan .= '


Terima kasih,
*Infinity In Your Hands*';

					$this->settings->sendWAOK($param2, $pesan);

			return true;
		}else{
			return false;
		}
	}



	function konter(){

		$total	=	$this->db->query("SELECT * FROM tb_konter WHERE bulan = LPAD(MONTH(now()), 2, '0') and tahun = DATE_FORMAT(now(), '%y')");
		if($total->num_rows() == 0){
			$this->db->insert('tb_konter', array('tahun' => date('y'), 'bulan' => date('m'), 'transaksi' => 'invoice', 'kode' => 'I', 'nomor' => 1));
			$this->db->insert('tb_konter', array('tahun' => date('y'), 'bulan' => date('m'), 'transaksi' => 'preorder', 'kode' => 'B', 'nomor' => 1));
			$this->db->insert('tb_konter', array('tahun' => date('y'), 'bulan' => date('m'), 'transaksi' => 'order', 'kode' => 'A', 'nomor' => 1));
			$this->db->insert('tb_konter', array('tahun' => date('y'), 'bulan' => date('m'), 'transaksi' => 'keuangan', 'kode' => 'K', 'nomor' => 1));
			$this->db->insert('tb_konter', array('tahun' => date('y'), 'bulan' => date('m'), 'transaksi' => 'po', 'kode' => 'P', 'nomor' => 1));
			$this->db->insert('tb_konter', array('tahun' => date('y'), 'bulan' => date('m'), 'transaksi' => 'op', 'kode' => 'OP', 'nomor' => 1));
			$this->db->insert('tb_konter', array('tahun' => date('y'), 'bulan' => date('m'), 'transaksi' => 'packing', 'kode' => 'C', 'nomor' => 1));
			$this->db->insert('tb_konter', array('tahun' => date('y'), 'bulan' => date('m'), 'transaksi' => 'receiving', 'kode' => 'D', 'nomor' => 1));
			$this->db->insert('tb_konter', array('tahun' => date('y'), 'bulan' => date('m'), 'transaksi' => 'asuransi', 'kode' => 'E', 'nomor' => 1));
			$this->db->insert('tb_konter', array('tahun' => date('y'), 'bulan' => date('m'), 'transaksi' => 'retur', 'kode' => 'R', 'nomor' => 1));
			$this->db->insert('tb_konter', array('tahun' => date('y'), 'bulan' => date('m'), 'transaksi' => 'Corpora Expres', 'kode' => 'CX', 'nomor' => 1));
		}

		return	$this->db->query("select concat(tahun,bulan,kode,SUBSTRING(concat('0000',nomor),-4,4)) as id from tb_konter where transaksi = 'order' and bulan = LPAD(MONTH(now()), 2, '0') and tahun = DATE_FORMAT(now(), '%y')")->row()->id;
	}
}
