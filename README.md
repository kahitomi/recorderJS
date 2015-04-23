# recorderJS
JS audio recorder, output wave blob

Now it is an angular service. But it does not base on other libraies, including angular.

##How to use

	$record.(function(Recording, Blob){
		// your code
	});

Recording: bool, if it is recording.

Blob: after recorded, return a wave format blob.